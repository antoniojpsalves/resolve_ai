import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/core/errors';
import { addComment, addCommentSchema } from '@/modules/occurrence/application/add-comment';
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

describe('addCommentSchema', () => {
  it('rejeita body vazio', () => {
    expect(addCommentSchema.safeParse({ body: '' }).success).toBe(false);
  });

  it('rejeita body só com espaços', () => {
    expect(addCommentSchema.safeParse({ body: '   ' }).success).toBe(false);
  });

  it('remove espaços das bordas do body válido', () => {
    const parsed = addCommentSchema.parse({ body: '  Obrigado pelo retorno.  ' });

    expect(parsed.body).toBe('Obrigado pelo retorno.');
  });
});

describe('addComment', () => {
  it('o autor comenta na própria ocorrência', async () => {
    const record = buildRecord();
    const { repository } = createInMemoryOccurrenceRepository([record]);

    const comment = await addComment(
      record.id,
      addCommentSchema.parse({ body: 'Aguardando retorno' }),
      ana,
      { occurrences: repository },
    );

    expect(comment).toMatchObject({
      occurrenceId: record.id,
      authorId: ana.id,
      body: 'Aguardando retorno',
    });
  });

  it('o gestor comenta em qualquer ocorrência', async () => {
    const record = buildRecord();
    const { repository } = createInMemoryOccurrenceRepository([record]);

    const comment = await addComment(
      record.id,
      addCommentSchema.parse({ body: 'Equipe acionada' }),
      gestor,
      { occurrences: repository },
    );

    expect(comment.authorId).toBe(gestor.id);
  });

  it('o comentário fica persistido e disponível em findById', async () => {
    const record = buildRecord();
    const { repository } = createInMemoryOccurrenceRepository([record]);

    await addComment(record.id, addCommentSchema.parse({ body: 'Primeiro comentário' }), ana, {
      occurrences: repository,
    });

    const detail = await repository.findById(record.id);
    expect(detail?.comments).toHaveLength(1);
    expect(detail?.comments[0]?.body).toBe('Primeiro comentário');
  });

  describe('404, não 403 — "não existe" e "existe mas não é sua" são indistinguíveis', () => {
    it('lança NotFoundError quando a ocorrência não existe', async () => {
      const { repository } = createInMemoryOccurrenceRepository([]);

      await expect(
        addComment(
          'occ-inexistente',
          addCommentSchema.parse({ body: 'Comentário qualquer' }),
          ana,
          { occurrences: repository },
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFoundError (não ForbiddenError) quando a ocorrência é de outra pessoa', async () => {
      const record = buildRecord({ createdById: ana.id });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const error = await addComment(
        record.id,
        addCommentSchema.parse({ body: 'Comentário indevido' }),
        bruno,
        { occurrences: repository },
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    });

    it('os dois casos produzem o mesmo status/code/title, indistinguíveis para quem pergunta', async () => {
      const record = buildRecord({ createdById: ana.id });
      const { repository } = createInMemoryOccurrenceRepository([record]);
      const body = addCommentSchema.parse({ body: 'Comentário qualquer' });

      async function captureError(occurrenceId: string): Promise<NotFoundError> {
        try {
          await addComment(occurrenceId, body, bruno, { occurrences: repository });
          throw new Error('esperava que addComment lançasse NotFoundError');
        } catch (error) {
          return error as NotFoundError;
        }
      }

      const naoExiste = await captureError('occ-inexistente');
      const naoEhDele = await captureError(record.id);

      expect(naoExiste.status).toBe(naoEhDele.status);
      expect(naoExiste.code).toBe(naoEhDele.code);
      expect(naoExiste.title).toBe(naoEhDele.title);

      // Nenhum comentário deve ter sido gravado nas tentativas negadas.
      const detail = await repository.findById(record.id);
      expect(detail?.comments).toHaveLength(0);
    });
  });
});
