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
 * Teste de integração de `POST /api/v1/occurrences/[id]/status` contra
 * Postgres real (infra da Parte A — `tests/integration/setup.ts` +
 * `resetDatabase()`).
 *
 * Não existe, na base, nenhum teste de rota que simule sessão via
 * cookie/token HTTP de verdade — o único precedente é
 * `tests/unit/core/auth-guards.test.ts`, que mocka `@/auth` (`vi.mock('@/auth', ...)`)
 * para controlar o retorno de `auth()`. Reaproveitamos exatamente esse
 * precedente aqui: chamamos o handler `POST` de verdade (exercitando
 * `requireSession` + o use-case + `prismaOccurrenceRepository` contra o
 * banco real), só substituindo `auth()` por um mock — sem simular
 * cookies/JWT do NextAuth. Isso cobre o 401 "sem sessão" (impossível de
 * produzir chamando o use-case diretamente, que nem recebe sessão, só
 * `Actor`) com o mesmo nível de fidelidade dos outros casos, todos batendo
 * no Postgres de verdade.
 */
vi.mock('@/auth', () => ({ auth: vi.fn() }));

const { auth } = await import('@/auth');
const { POST } = await import('@/app/api/v1/occurrences/[id]/status/route');
const authMock = vi.mocked(auth as unknown as () => Promise<Session | null>);

function sessionFor(user: { id: string; role: 'SOLICITANTE' | 'GESTOR' }): Session {
  return {
    user: { id: user.id, name: 'Usuário de teste', email: 'teste@example.com', role: user.role },
    expires: '2026-12-31T00:00:00.000Z',
  } as Session;
}

function postStatus(occurrenceId: string, body: unknown): Promise<Response> {
  const request = new Request(`http://localhost/api/v1/occurrences/${occurrenceId}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return POST(request, { params: Promise.resolve({ id: occurrenceId }) });
}

describe('POST /api/v1/occurrences/[id]/status (integração)', () => {
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
    });

    const response = await postStatus(occurrence.id, { toStatus: 'EM_ANALISE' });

    expect(response.status).toBe(401);
  });

  it('403 quando o solicitante tenta uma transição que não é cancelar a própria ocorrência', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      status: 'ABERTA',
    });

    authMock.mockResolvedValue(sessionFor(solicitante));

    const response = await postStatus(occurrence.id, { toStatus: 'EM_ANALISE' });

    expect(response.status).toBe(403);
  });

  it('200 com o gestor movendo ABERTA -> EM_ANALISE, gravando a StatusHistory correta', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      status: 'ABERTA',
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await postStatus(occurrence.id, {
      toStatus: 'EM_ANALISE',
      note: 'Iniciando análise',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('EM_ANALISE');

    const history = await prisma.statusHistory.findMany({
      where: { occurrenceId: occurrence.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(history).toHaveLength(2); // criação (ABERTA) + esta mudança
    expect(history[1]).toMatchObject({
      fromStatus: 'ABERTA',
      toStatus: 'EM_ANALISE',
      note: 'Iniciando análise',
      changedById: gestor.id,
    });
  });

  it('422 tentando ir para RESOLVIDA sem resolutionNote', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      status: 'EM_ATENDIMENTO',
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await postStatus(occurrence.id, { toStatus: 'RESOLVIDA' });

    expect(response.status).toBe(422);
  });

  it('409 tentando transicionar uma ocorrência já RESOLVIDA', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      status: 'RESOLVIDA',
      resolutionNote: 'Já resolvido antes',
      resolvedAt: new Date(),
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await postStatus(occurrence.id, { toStatus: 'EM_ANALISE' });

    expect(response.status).toBe(409);
  });
});
