import type { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase } from './helpers/db';
import {
  createFixtureCategory,
  createFixtureOccurrence,
  createFixtureUser,
} from './helpers/fixtures';

/**
 * Teste de integração de `PATCH /api/v1/occurrences/[id]` (prioridade e
 * responsável) e da ordenação do backlog (`GET /api/v1/occurrences?sortBy=...`)
 * contra Postgres real — mesma infra e mesmo precedente de mock de sessão de
 * `tests/integration/occurrences-status.test.ts` (`vi.mock('@/auth', ...)`).
 */
vi.mock('@/auth', () => ({ auth: vi.fn() }));

const { auth } = await import('@/auth');
const { PATCH } = await import('@/app/api/v1/occurrences/[id]/route');
const { GET: listOccurrences } = await import('@/app/api/v1/occurrences/route');
const authMock = vi.mocked(auth as unknown as () => Promise<Session | null>);

function sessionFor(user: { id: string; role: 'SOLICITANTE' | 'GESTOR' }): Session {
  return {
    user: { id: user.id, name: 'Usuário de teste', email: 'teste@example.com', role: user.role },
    expires: '2026-12-31T00:00:00.000Z',
  } as Session;
}

function patchOccurrence(occurrenceId: string, body: unknown): Promise<Response> {
  const request = new Request(`http://localhost/api/v1/occurrences/${occurrenceId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return PATCH(request, { params: Promise.resolve({ id: occurrenceId }) });
}

function listOccurrencesWith(query: string): Promise<Response> {
  const request = new Request(`http://localhost/api/v1/occurrences?${query}`);

  return listOccurrences(request);
}

describe('PATCH /api/v1/occurrences/[id] (integração)', () => {
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

    const response = await patchOccurrence(occurrence.id, { priority: 'ALTA' });

    expect(response.status).toBe(401);
  });

  it('403 quando um SOLICITANTE tenta mudar a prioridade (ação exclusiva de GESTOR)', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
    });

    authMock.mockResolvedValue(sessionFor(solicitante));

    const response = await patchOccurrence(occurrence.id, { priority: 'ALTA' });

    expect(response.status).toBe(403);
  });

  it('404 quando a ocorrência não existe', async () => {
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await patchOccurrence('occ-inexistente', { priority: 'ALTA' });

    expect(response.status).toBe(404);
  });

  it('404 quando assignedToId aponta para um SOLICITANTE, não um GESTOR (regra nova desta tarefa)', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await patchOccurrence(occurrence.id, { assignedToId: solicitante.id });

    expect(response.status).toBe(404);
  });

  it('200 mudando só a prioridade', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'MEDIA',
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await patchOccurrence(occurrence.id, { priority: 'URGENTE' });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { priority: string; assignedToId: string | null };
    expect(body.priority).toBe('URGENTE');
    expect(body.assignedToId).toBeNull();
  });

  it('200 atribuindo um GESTOR válido como responsável', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const outroGestor = await createFixtureUser({ role: 'GESTOR' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await patchOccurrence(occurrence.id, { assignedToId: outroGestor.id });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { assignedToId: string | null };
    expect(body.assignedToId).toBe(outroGestor.id);
  });

  it('200 mudando prioridade e responsável no mesmo PATCH — o registro final reflete as duas mudanças', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const responsavel = await createFixtureUser({ role: 'GESTOR' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'BAIXA',
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await patchOccurrence(occurrence.id, {
      priority: 'ALTA',
      assignedToId: responsavel.id,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      priority: string;
      assignedToId: string | null;
      assignedToName: string | null;
    };
    expect(body.priority).toBe('ALTA');
    expect(body.assignedToId).toBe(responsavel.id);
    expect(body.assignedToName).toBe(responsavel.name);
  });

  it('desatribui passando assignedToId: null', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });
    const occurrence = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      assignedToId: gestor.id,
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await patchOccurrence(occurrence.id, { assignedToId: null });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { assignedToId: string | null };
    expect(body.assignedToId).toBeNull();
  });
});

describe('GET /api/v1/occurrences?sortBy=priority (integração — prova da ordem nativa do enum)', () => {
  beforeEach(async () => {
    await resetDatabase();
    authMock.mockReset();
  });

  it('sortBy=priority&sortOrder=asc devolve BAIXA, MEDIA, ALTA, URGENTE nessa ordem — a ordem nativa de declaração do enum no Postgres, sem CASE WHEN', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });

    // Criadas fora de ordem de propósito: se a ordenação dependesse da ordem
    // de inserção ou fosse alfabética (ALTA, BAIXA, MEDIA, URGENTE), este
    // teste pegaria isso.
    const urgente = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'URGENTE',
    });
    const baixa = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'BAIXA',
    });
    const alta = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'ALTA',
    });
    const media = await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'MEDIA',
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await listOccurrencesWith('sortBy=priority&sortOrder=asc');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string; priority: string }> };

    expect(body.data.map((o) => o.priority)).toEqual(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']);
    expect(body.data.map((o) => o.id)).toEqual([baixa.id, media.id, alta.id, urgente.id]);
  });

  it('sortBy=priority&sortOrder=desc inverte: URGENTE, ALTA, MEDIA, BAIXA', async () => {
    const category = await createFixtureCategory();
    const solicitante = await createFixtureUser({ role: 'SOLICITANTE' });
    const gestor = await createFixtureUser({ role: 'GESTOR' });

    await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'MEDIA',
    });
    await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'URGENTE',
    });
    await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'BAIXA',
    });
    await createFixtureOccurrence({
      createdById: solicitante.id,
      categoryId: category.id,
      priority: 'ALTA',
    });

    authMock.mockResolvedValue(sessionFor(gestor));

    const response = await listOccurrencesWith('sortBy=priority&sortOrder=desc');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ priority: string }> };

    expect(body.data.map((o) => o.priority)).toEqual(['URGENTE', 'ALTA', 'MEDIA', 'BAIXA']);
  });
});
