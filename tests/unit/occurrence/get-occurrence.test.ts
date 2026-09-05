import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/core/errors';
import { getOccurrence } from '@/modules/occurrence/application/get-occurrence';
import type { OccurrenceRecord } from '@/modules/occurrence/application/ports/occurrence-repository';
import type { Actor } from '@/modules/occurrence/domain/occurrence';

import { createInMemoryOccurrenceRepository } from '../../helpers/occurrence-repository';

const ana: Actor = { id: 'user-ana', role: 'SOLICITANTE' };
const bruno: Actor = { id: 'user-bruno', role: 'SOLICITANTE' };
const gestor: Actor = { id: 'user-gestor', role: 'GESTOR' };

function buildRecord(overrides: Partial<OccurrenceRecord> = {}): OccurrenceRecord {
  return {
    id: 'occ-ana-1',
    code: 'OC-2026-000001',
    title: 'Vazamento na garagem',
    description: 'Água acumulada perto da vaga 12',
    status: 'ABERTA',
    priority: 'MEDIA',
    categoryId: 'cat-hidraulica',
    locationLabel: 'Bloco B, garagem -1',
    latitude: null,
    longitude: null,
    imageUrl: null,
    imageKey: null,
    createdById: ana.id,
    assignedToId: null,
    resolutionNote: null,
    resolvedAt: null,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('getOccurrence', () => {
  it('devolve o detalhe para o gestor, com histórico e comentários em ordem cronológica crescente', async () => {
    const record = buildRecord();
    const { repository } = createInMemoryOccurrenceRepository([
      {
        ...record,
        history: [
          {
            id: 'hist-1',
            fromStatus: null,
            toStatus: 'ABERTA',
            note: null,
            changedById: ana.id,
            createdAt: new Date('2026-08-01T10:00:00.000Z'),
          },
          {
            id: 'hist-2',
            fromStatus: 'ABERTA',
            toStatus: 'EM_ANALISE',
            note: 'Em análise',
            changedById: gestor.id,
            createdAt: new Date('2026-08-02T10:00:00.000Z'),
          },
        ],
        comments: [
          {
            id: 'com-1',
            occurrenceId: record.id,
            authorId: ana.id,
            body: 'Alguma novidade?',
            createdAt: new Date('2026-08-01T12:00:00.000Z'),
          },
          {
            id: 'com-2',
            occurrenceId: record.id,
            authorId: gestor.id,
            body: 'Equipe já foi acionada.',
            createdAt: new Date('2026-08-01T13:00:00.000Z'),
          },
        ],
        rating: null,
      },
    ]);

    const detail = await getOccurrence(record.id, gestor, { occurrences: repository });

    expect(detail.id).toBe(record.id);
    expect(detail.history.map((h) => h.toStatus)).toEqual(['ABERTA', 'EM_ANALISE']);
    expect(detail.comments.map((c) => c.id)).toEqual(['com-1', 'com-2']);
    expect(detail.rating).toBeNull();
  });

  it('devolve o detalhe para o próprio autor', async () => {
    const record = buildRecord();
    const { repository } = createInMemoryOccurrenceRepository([record]);

    const detail = await getOccurrence(record.id, ana, { occurrences: repository });

    expect(detail.id).toBe(record.id);
  });

  it('inclui a avaliação quando houver', async () => {
    const record = buildRecord({ status: 'RESOLVIDA' });
    const { repository } = createInMemoryOccurrenceRepository([
      {
        ...record,
        rating: { id: 'rating-1', score: 5, comment: 'Ótimo atendimento', createdAt: new Date() },
      },
    ]);

    const detail = await getOccurrence(record.id, ana, { occurrences: repository });

    expect(detail.rating).toEqual({
      id: 'rating-1',
      score: 5,
      comment: 'Ótimo atendimento',
      createdAt: expect.any(Date),
    });
  });

  describe('404, não 403 — "não existe" e "existe mas não é sua" são indistinguíveis', () => {
    it('lança NotFoundError quando a ocorrência não existe', async () => {
      const { repository } = createInMemoryOccurrenceRepository([]);

      await expect(
        getOccurrence('occ-inexistente', ana, { occurrences: repository }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFoundError (não ForbiddenError) quando a ocorrência existe mas é de outra pessoa', async () => {
      const record = buildRecord({ createdById: ana.id });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const error = await getOccurrence(record.id, bruno, { occurrences: repository }).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    });

    it('os dois casos produzem o mesmo status/code/title, indistinguíveis para quem pergunta', async () => {
      const record = buildRecord({ createdById: ana.id });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      async function captureError(occurrenceId: string): Promise<NotFoundError> {
        try {
          await getOccurrence(occurrenceId, bruno, { occurrences: repository });
          throw new Error('esperava que getOccurrence lançasse NotFoundError');
        } catch (error) {
          return error as NotFoundError;
        }
      }

      const naoExiste = await captureError('occ-inexistente');
      const naoEhDele = await captureError(record.id);

      expect(naoExiste.status).toBe(naoEhDele.status);
      expect(naoExiste.code).toBe(naoEhDele.code);
      expect(naoExiste.title).toBe(naoEhDele.title);
    });
  });
});
