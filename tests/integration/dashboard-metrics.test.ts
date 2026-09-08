import type { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/core/db/prisma';

import { resetDatabase } from './helpers/db';
import {
  createFixtureCategory,
  createFixtureOccurrence,
  createFixtureUser,
} from './helpers/fixtures';

/**
 * Teste de integração de `GET /api/v1/dashboard/metrics` contra Postgres
 * real. Mesmo precedente de `occurrences-rating.test.ts`: mocka `@/auth` em
 * vez de simular cookies/JWT do NextAuth, chamando o handler `GET` de
 * verdade (exercitando `requireRole('GESTOR')` + o use-case +
 * `prismaDashboardRepository` contra o banco real).
 */
vi.mock('@/auth', () => ({ auth: vi.fn() }));

const { auth } = await import('@/auth');
const { GET } = await import('@/app/api/v1/dashboard/metrics/route');
const authMock = vi.mocked(auth as unknown as () => Promise<Session | null>);

function sessionFor(user: { id: string; role: 'SOLICITANTE' | 'GESTOR' }): Session {
  return {
    user: { id: user.id, name: 'Usuário de teste', email: 'teste@example.com', role: user.role },
    expires: '2026-12-31T00:00:00.000Z',
  } as Session;
}

function getMetrics(query = ''): Promise<Response> {
  const request = new Request(`http://localhost/api/v1/dashboard/metrics${query}`);

  return GET(request);
}

/** `YYYY-MM-DD` a partir de um `Date` UTC — mesma convenção do `TimeSeriesPoint.date`. */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Meio-dia UTC de hoje, deslocado `days` dias para trás — longe de meia-noite, evita flakiness de fronteira de dia. */
function daysAgoNoonUtc(base: Date, days: number): Date {
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12, 0, 0) -
      days * 24 * 60 * 60 * 1000,
  );
}

describe('GET /api/v1/dashboard/metrics (integração)', () => {
  beforeEach(async () => {
    await resetDatabase();
    authMock.mockReset();
  });

  it('401 sem sessão', async () => {
    authMock.mockResolvedValue(null);

    const response = await getMetrics();

    expect(response.status).toBe(401);
  });

  it('403 quando quem solicita não é GESTOR', async () => {
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    authMock.mockResolvedValue(sessionFor(solicitante));

    const response = await getMetrics();

    expect(response.status).toBe(403);
  });

  it('calcula os 8 indicadores corretamente para um cenário conhecido', async () => {
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const criador = await createFixtureUser({ role: 'SOLICITANTE' });
    const respA = await createFixtureUser({ role: 'GESTOR', name: 'Responsável A' });
    const respB = await createFixtureUser({ role: 'GESTOR', name: 'Responsável B' });

    const catA = await createFixtureCategory({ name: 'Categoria A', slug: 'categoria-a' });
    const catB = await createFixtureCategory({ name: 'Categoria B', slug: 'categoria-b' });

    const now = new Date();
    const d0 = daysAgoNoonUtc(now, 0);
    const d1 = daysAgoNoonUtc(now, 1);
    const d2 = daysAgoNoonUtc(now, 2);
    const d9 = daysAgoNoonUtc(now, 9);
    const d2Plus10h = new Date(d2.getTime() + 10 * 60 * 60 * 1000);

    // Occ1: ABERTA, catA, respA, ALTA, criada hoje (d0).
    const occ1 = await createFixtureOccurrence({
      createdById: criador.id,
      categoryId: catA.id,
      status: 'ABERTA',
      priority: 'ALTA',
      assignedToId: respA.id,
    });
    await prisma.occurrence.update({ where: { id: occ1.id }, data: { createdAt: d0 } });

    // Occ2: EM_ATENDIMENTO, catB, respA (2º com respA), URGENTE, criada hoje (d0).
    const occ2 = await createFixtureOccurrence({
      createdById: criador.id,
      categoryId: catB.id,
      status: 'EM_ATENDIMENTO',
      priority: 'URGENTE',
      assignedToId: respA.id,
    });
    await prisma.occurrence.update({ where: { id: occ2.id }, data: { createdAt: d0 } });

    // Occ3: RESOLVIDA, catA, respB, MEDIA, criada em d2, resolvida 10h depois (ainda em d2).
    const occ3 = await createFixtureOccurrence({
      createdById: criador.id,
      categoryId: catA.id,
      status: 'RESOLVIDA',
      priority: 'MEDIA',
      assignedToId: respB.id,
      resolutionNote: 'Resolvido para teste',
      resolvedAt: d2Plus10h,
    });
    await prisma.occurrence.update({ where: { id: occ3.id }, data: { createdAt: d2 } });

    // Occ4: CANCELADA, catB, sem responsável, MEDIA, criada ontem (d1) — terminal, nunca conta como overdue.
    const occ4 = await createFixtureOccurrence({
      createdById: criador.id,
      categoryId: catB.id,
      status: 'CANCELADA',
      priority: 'MEDIA',
    });
    await prisma.occurrence.update({ where: { id: occ4.id }, data: { createdAt: d1 } });

    // Occ5: ABERTA, catA, sem responsável, BAIXA, criada há 9 dias — overdue com overdueDays=5.
    const occ5 = await createFixtureOccurrence({
      createdById: criador.id,
      categoryId: catA.id,
      status: 'ABERTA',
      priority: 'BAIXA',
    });
    await prisma.occurrence.update({ where: { id: occ5.id }, data: { createdAt: d9 } });

    // Avaliações: uma sobre occ1 (score 5) e outra sobre occ3 (score 3) — média manual 4.
    await prisma.rating.create({ data: { occurrenceId: occ1.id, score: 5 } });
    await prisma.rating.create({ data: { occurrenceId: occ3.id, score: 3 } });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await getMetrics('?overdueDays=5');

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      totalByStatus: { status: string; count: number }[];
      totalByCategory: { categoryId: string; categoryName: string; count: number }[];
      totalByPriority: { priority: string; count: number }[];
      overdueCount: number;
      overdueDays: number;
      averageResolutionHours: number | null;
      timeSeries: { date: string; opened: number; resolved: number }[];
      topResponsibles: { userId: string; userName: string; count: number }[];
      averageRating: number | null;
    };

    // 1. totalByStatus — todas as 5 chaves de ALL_STATUSES presentes, mesmo com count 0.
    expect(body.totalByStatus).toEqual(
      expect.arrayContaining([
        { status: 'ABERTA', count: 2 },
        { status: 'EM_ANALISE', count: 0 },
        { status: 'EM_ATENDIMENTO', count: 1 },
        { status: 'RESOLVIDA', count: 1 },
        { status: 'CANCELADA', count: 1 },
      ]),
    );
    expect(body.totalByStatus).toHaveLength(5);

    // 2. totalByCategory — catA: occ1+occ3+occ5=3, catB: occ2+occ4=2.
    expect(body.totalByCategory).toEqual(
      expect.arrayContaining([
        { categoryId: catA.id, categoryName: 'Categoria A', count: 3 },
        { categoryId: catB.id, categoryName: 'Categoria B', count: 2 },
      ]),
    );
    expect(body.totalByCategory).toHaveLength(2);

    // 3. totalByPriority — todas as 4 chaves de ALL_PRIORITIES presentes.
    expect(body.totalByPriority).toEqual(
      expect.arrayContaining([
        { priority: 'BAIXA', count: 1 },
        { priority: 'MEDIA', count: 2 },
        { priority: 'ALTA', count: 1 },
        { priority: 'URGENTE', count: 1 },
      ]),
    );
    expect(body.totalByPriority).toHaveLength(4);

    // 4. overdueCount — só occ5 (ABERTA, criada há 9 dias > overdueDays=5); occ4 é CANCELADA (terminal, nunca overdue).
    expect(body.overdueCount).toBe(1);
    expect(body.overdueDays).toBe(5);

    // 5. averageResolutionHours — só occ3 resolvida, resolvedAt - createdAt = exatos 10h.
    // `typeof === 'number'` explícito: `$queryRaw` devolve `avg_hours` como um
    // `Prisma.Decimal` cujo `toJSON()` serializa como string — sem a
    // normalização em `prisma-dashboard-repository.ts`, este campo chegaria
    // como `"10"` (string) no JSON da rota, quebrando o contrato `number | null`
    // sem que `toBeCloseTo` sozinho (que coage string↔number) acusasse nada.
    expect(typeof body.averageResolutionHours).toBe('number');
    expect(body.averageResolutionHours).toBeCloseTo(10, 5);

    // 6. timeSeries — 30 pontos, sem buraco, contagens batendo com as datas plantadas.
    expect(body.timeSeries).toHaveLength(30);
    const byDate = new Map(body.timeSeries.map((p) => [p.date, p]));
    expect(byDate.get(toISODate(d0))).toEqual({ date: toISODate(d0), opened: 2, resolved: 0 });
    expect(byDate.get(toISODate(d1))).toEqual({ date: toISODate(d1), opened: 1, resolved: 0 });
    expect(byDate.get(toISODate(d2))).toEqual({ date: toISODate(d2), opened: 1, resolved: 1 });
    expect(byDate.get(toISODate(d9))).toEqual({ date: toISODate(d9), opened: 1, resolved: 0 });
    const totalOpened = body.timeSeries.reduce((sum, p) => sum + p.opened, 0);
    const totalResolved = body.timeSeries.reduce((sum, p) => sum + p.resolved, 0);
    expect(totalOpened).toBe(5);
    expect(totalResolved).toBe(1);

    // 7. topResponsibles — respA (2) antes de respB (1); sem responsável (occ4, occ5) excluído.
    expect(body.topResponsibles).toEqual([
      { userId: respA.id, userName: 'Responsável A', count: 2 },
      { userId: respB.id, userName: 'Responsável B', count: 1 },
    ]);

    // 8. averageRating — (5 + 3) / 2 = 4.
    expect(body.averageRating).toBe(4);
  });

  it('averageResolutionHours e averageRating são null sem dados', async () => {
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const criador = await createFixtureUser({ role: 'SOLICITANTE' });
    const category = await createFixtureCategory();

    await createFixtureOccurrence({ createdById: criador.id, categoryId: category.id });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await getMetrics();
    const body = (await response.json()) as {
      averageResolutionHours: number | null;
      averageRating: number | null;
      overdueDays: number;
    };

    expect(body.averageResolutionHours).toBeNull();
    expect(body.averageRating).toBeNull();
    expect(body.overdueDays).toBe(7);
  });
});
