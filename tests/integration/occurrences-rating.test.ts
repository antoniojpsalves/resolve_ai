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
 * Teste de integração de `POST /api/v1/occurrences/[id]/rating` contra
 * Postgres real. Mesmo precedente de `occurrences-status.test.ts`: mocka
 * `@/auth` (`vi.mock('@/auth', ...)`) em vez de simular cookies/JWT do
 * NextAuth, chamando o handler `POST` de verdade (exercitando
 * `requireSession` + o use-case + `prismaOccurrenceRepository` contra o
 * banco real).
 */
vi.mock('@/auth', () => ({ auth: vi.fn() }));

const { auth } = await import('@/auth');
const { POST } = await import('@/app/api/v1/occurrences/[id]/rating/route');
const authMock = vi.mocked(auth as unknown as () => Promise<Session | null>);

function sessionFor(user: { id: string; role: 'SOLICITANTE' | 'GESTOR' }): Session {
  return {
    user: { id: user.id, name: 'Usuário de teste', email: 'teste@example.com', role: user.role },
    expires: '2026-12-31T00:00:00.000Z',
  } as Session;
}

function postRating(occurrenceId: string, body: unknown): Promise<Response> {
  const request = new Request(`http://localhost/api/v1/occurrences/${occurrenceId}/rating`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return POST(request, { params: Promise.resolve({ id: occurrenceId }) });
}

describe('POST /api/v1/occurrences/[id]/rating (integração)', () => {
  beforeEach(async () => {
    await resetDatabase();
    authMock.mockReset();
  });

  it('401 sem sessão', async () => {
    authMock.mockResolvedValue(null);

    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      status: 'RESOLVIDA',
      resolutionNote: 'Conserto feito',
      resolvedAt: new Date(),
    });

    const response = await postRating(occurrence.id, { score: 5 });

    expect(response.status).toBe(401);
  });

  it('404 quando quem tenta avaliar não é o autor da ocorrência', async () => {
    const category = await createFixtureCategory();
    const dono = await createFixtureUser({ role: 'SOLICITANTE' });
    const naoDono = await createFixtureUser({ role: 'SOLICITANTE' });
    const occurrence = await createFixtureOccurrence({
      createdById: dono.id,
      categoryId: category.id,
      status: 'RESOLVIDA',
      resolutionNote: 'Conserto feito',
      resolvedAt: new Date(),
    });

    authMock.mockResolvedValue(sessionFor(naoDono));

    const response = await postRating(occurrence.id, { score: 5 });

    expect(response.status).toBe(404);
  });

  it('409 quando a ocorrência ainda está ABERTA (não pode avaliar ainda)', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      status: 'ABERTA',
    });

    authMock.mockResolvedValue(sessionFor(solicitante));

    const response = await postRating(occurrence.id, { score: 5 });

    expect(response.status).toBe(409);
  });

  it('201 quando o autor avalia a própria ocorrência RESOLVIDA, gravando a linha correta', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      status: 'RESOLVIDA',
      resolutionNote: 'Conserto feito',
      resolvedAt: new Date(),
    });

    authMock.mockResolvedValue(sessionFor(solicitante));

    const response = await postRating(occurrence.id, { score: 4, comment: 'Bom atendimento' });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; score: number; comment: string | null };
    expect(body.score).toBe(4);
    expect(body.comment).toBe('Bom atendimento');

    const row = await prisma.rating.findUnique({ where: { occurrenceId: occurrence.id } });

    expect(row).toMatchObject({
      occurrenceId: occurrence.id,
      score: 4,
      comment: 'Bom atendimento',
    });
  });

  it('409 na segunda tentativa de avaliar a mesma ocorrência', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      status: 'RESOLVIDA',
      resolutionNote: 'Conserto feito',
      resolvedAt: new Date(),
    });

    authMock.mockResolvedValue(sessionFor(solicitante));

    const first = await postRating(occurrence.id, { score: 5 });
    expect(first.status).toBe(201);

    const second = await postRating(occurrence.id, { score: 3 });
    expect(second.status).toBe(409);

    const count = await prisma.rating.count({ where: { occurrenceId: occurrence.id } });
    expect(count).toBe(1);
  });
});
