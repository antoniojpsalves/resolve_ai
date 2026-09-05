import { describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError } from '@/core/errors';
import {
  createOccurrence,
  createOccurrenceSchema,
  type CreateOccurrenceInput,
} from '@/modules/occurrence/application/create-occurrence';
import {
  OccurrenceCodeConflictError,
  type OccurrenceRecord,
  type OccurrenceRepository,
} from '@/modules/occurrence/application/ports/occurrence-repository';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { buildOccurrenceCode } from '@/modules/occurrence/domain/protocol';

import { createInMemoryCategoryRepository } from '../../helpers/category-repository';
import { createInMemoryOccurrenceRepository } from '../../helpers/occurrence-repository';

const actor: Actor = { id: 'user-ana', role: 'SOLICITANTE' };

const validInput: CreateOccurrenceInput = {
  title: 'Vazamento na garagem',
  description: 'Há um vazamento visível na tubulação do teto da garagem.',
  categoryId: 'cat-hidraulica',
  locationLabel: 'Bloco B, garagem -1',
};

const deps = (occurrences: OccurrenceRepository) => ({
  occurrences,
  categories: createInMemoryCategoryRepository([{ id: 'cat-hidraulica', active: true }]).repository,
});

describe('createOccurrenceSchema', () => {
  it.each([
    ['título vazio', { ...validInput, title: '  ' }],
    ['descrição vazia', { ...validInput, description: '' }],
    ['categoryId vazio', { ...validInput, categoryId: '' }],
    ['locationLabel vazio', { ...validInput, locationLabel: '   ' }],
    ['latitude fora do intervalo', { ...validInput, latitude: 999 }],
    ['longitude fora do intervalo', { ...validInput, longitude: -999 }],
    ['imageUrl inválida', { ...validInput, imageUrl: 'nao-eh-url' }],
    [
      'imageUrl protocol-relative (//evil.com/x.png)',
      { ...validInput, imageUrl: '//evil.com/x.png' },
    ],
    [
      'imageUrl com esquema não http(s) (javascript:alert(1))',
      { ...validInput, imageUrl: 'javascript:alert(1)' },
    ],
  ])('rejeita %s', (_label, input) => {
    expect(createOccurrenceSchema.safeParse(input).success).toBe(false);
  });

  it('aceita latitude/longitude/imageUrl/imageKey quando presentes e válidos', () => {
    const parsed = createOccurrenceSchema.safeParse({
      ...validInput,
      latitude: -23.55,
      longitude: -46.63,
      imageUrl: 'https://cdn.resolveai.com/img.png',
      imageKey: 'occurrences/img.png',
    });

    expect(parsed.success).toBe(true);
  });

  it('aceita imageUrl relativa — o formato devolvido pelo upload em storage local (Tarefa 3)', () => {
    const parsed = createOccurrenceSchema.safeParse({
      ...validInput,
      imageUrl: '/api/v1/uploads/325bd65a-44ab-443f-ac5f-bbe82a064e0d.png',
      imageKey: '325bd65a-44ab-443f-ac5f-bbe82a064e0d.png',
    });

    expect(parsed.success).toBe(true);
  });

  it('descarta campos desconhecidos (ex.: status/priority enviados pelo cliente)', () => {
    const parsed = createOccurrenceSchema.parse({ ...validInput, status: 'RESOLVIDA' });

    expect(parsed).not.toHaveProperty('status');
  });
});

describe('createOccurrence', () => {
  it('cria a ocorrência com status ABERTA e priority MEDIA', async () => {
    const { repository } = createInMemoryOccurrenceRepository();

    const result = await createOccurrence(validInput, actor, deps(repository));

    expect(result.status).toBe('ABERTA');
    expect(result.priority).toBe('MEDIA');
    expect(result.createdById).toBe(actor.id);
    expect(result.title).toBe(validInput.title);
  });

  it('gera o code no formato OC-<ano>-NNNNNN', async () => {
    const { repository } = createInMemoryOccurrenceRepository();

    const result = await createOccurrence(validInput, actor, deps(repository));
    const year = new Date().getUTCFullYear();

    expect(result.code).toBe(buildOccurrenceCode(year, 1));
  });

  it('grava a entrada inicial de histórico com fromStatus null na mesma transação', async () => {
    const { repository, rows } = createInMemoryOccurrenceRepository();

    const result = await createOccurrence(validInput, actor, deps(repository));

    const stored = rows.get(result.id);
    expect(stored).toBeDefined();
    expect(stored!.history).toHaveLength(1);
    expect(stored!.history[0]).toMatchObject({
      fromStatus: null,
      toStatus: 'ABERTA',
      changedById: actor.id,
    });
  });

  it('lança NotFoundError quando a categoria não existe', async () => {
    const { repository } = createInMemoryOccurrenceRepository();
    const { repository: categories } = createInMemoryCategoryRepository([]);

    await expect(
      createOccurrence(validInput, actor, { occurrences: repository, categories }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lança NotFoundError quando a categoria existe mas está inativa', async () => {
    const { repository } = createInMemoryOccurrenceRepository();
    const { repository: categories } = createInMemoryCategoryRepository([
      { id: 'cat-hidraulica', active: false },
    ]);

    await expect(
      createOccurrence(validInput, actor, { occurrences: repository, categories }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('recalcula a sequência e tenta de novo quando o code colide (corrida entre dois POSTs)', async () => {
    let createCalls = 0;
    let sequenceCalls = 0;
    const year = new Date().getUTCFullYear();

    // Fake com controle fino sobre o número de chamadas: simula duas
    // requisições concorrentes que leem a mesma "próxima sequência" antes de
    // qualquer uma confirmar o create. A primeira `create` rejeita como o
    // P2002 do Postgres rejeitaria (traduzido para OccurrenceCodeConflictError
    // pela implementação Prisma); a segunda leitura de `nextSequenceForYear`
    // já reflete a sequência seguinte, e o segundo `create` aceita.
    const occurrences: OccurrenceRepository = {
      async create(input): Promise<OccurrenceRecord> {
        createCalls += 1;
        if (createCalls === 1) {
          throw new OccurrenceCodeConflictError();
        }

        return {
          id: 'occ-1',
          code: input.code,
          title: input.title,
          description: input.description,
          status: 'ABERTA',
          priority: 'MEDIA',
          categoryId: input.categoryId,
          locationLabel: input.locationLabel,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          imageUrl: input.imageUrl ?? null,
          imageKey: input.imageKey ?? null,
          createdById: input.createdById,
          assignedToId: null,
          resolutionNote: null,
          resolvedAt: null,
          createdAt: new Date('2026-09-01T12:00:00.000Z'),
          updatedAt: new Date('2026-09-01T12:00:00.000Z'),
        };
      },
      async nextSequenceForYear(): Promise<number> {
        sequenceCalls += 1;
        return sequenceCalls;
      },
      async list() {
        throw new Error('não usado neste teste');
      },
      async findById() {
        throw new Error('não usado neste teste');
      },
      async addComment() {
        throw new Error('não usado neste teste');
      },
    };

    const result = await createOccurrence(validInput, actor, deps(occurrences));

    expect(sequenceCalls).toBe(2);
    expect(createCalls).toBe(2);
    expect(result.code).toBe(buildOccurrenceCode(year, 2));
  });

  it('desiste após esgotar as tentativas e sobe um erro claro, sem código duplicado', async () => {
    const { repository } = createInMemoryOccurrenceRepository([], {
      createBehaviors: ['conflict', 'conflict', 'conflict', 'conflict', 'conflict'],
    });

    await expect(createOccurrence(validInput, actor, deps(repository))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
