import { describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError } from '@/core/errors';
import {
  rateOccurrence,
  rateOccurrenceSchema,
} from '@/modules/occurrence/application/rate-occurrence';
import type {
  OccurrenceRecord,
  RatingEntry,
} from '@/modules/occurrence/application/ports/occurrence-repository';
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
    status: 'RESOLVIDA',
    priority: 'MEDIA',
    categoryId: 'cat-hidraulica',
    categoryName: 'Hidráulica',
    locationLabel: 'Bloco B, garagem -1',
    latitude: null,
    longitude: null,
    imageUrl: null,
    imageKey: null,
    createdById: ana.id,
    assignedToId: null,
    assignedToName: null,
    resolutionNote: 'Conserto feito',
    resolvedAt: new Date('2026-08-05T10:00:00.000Z'),
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-05T10:00:00.000Z'),
    ...overrides,
  };
}

function buildRating(overrides: Partial<RatingEntry> = {}): RatingEntry {
  return {
    id: 'rating-existente',
    score: 4,
    comment: 'Bom atendimento',
    createdAt: new Date('2026-08-06T10:00:00.000Z'),
    ...overrides,
  };
}

describe('rateOccurrenceSchema', () => {
  it('aceita score inteiro entre 1 e 5, com ou sem comment', () => {
    expect(rateOccurrenceSchema.safeParse({ score: 1 }).success).toBe(true);
    expect(rateOccurrenceSchema.safeParse({ score: 5, comment: 'Ótimo' }).success).toBe(true);
  });

  it('rejeita score fora de 1-5', () => {
    expect(rateOccurrenceSchema.safeParse({ score: 0 }).success).toBe(false);
    expect(rateOccurrenceSchema.safeParse({ score: 6 }).success).toBe(false);
  });

  it('rejeita score não-inteiro', () => {
    expect(rateOccurrenceSchema.safeParse({ score: 3.5 }).success).toBe(false);
  });

  it('rejeita campo desconhecido no corpo (.strict())', () => {
    expect(rateOccurrenceSchema.safeParse({ score: 5, extra: 'nope' }).success).toBe(false);
  });

  it('comment vazio ou só espaço não passa no min(1)', () => {
    expect(rateOccurrenceSchema.safeParse({ score: 5, comment: '' }).success).toBe(false);
    expect(rateOccurrenceSchema.safeParse({ score: 5, comment: '   ' }).success).toBe(false);
  });
});

describe('rateOccurrence', () => {
  it('lança NotFoundError quando a ocorrência não existe', async () => {
    const { repository: occurrences } = createInMemoryOccurrenceRepository([]);

    await expect(
      rateOccurrence('occ-inexistente', ana, { score: 5 }, { occurrences }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lança NotFoundError quando o ator não é o autor (outro solicitante)', async () => {
    const record = buildRecord();
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);

    const error = await rateOccurrence(record.id, bruno, { score: 5 }, { occurrences }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404 });
  });

  it('lança NotFoundError quando o ator é GESTOR (nunca é o autor da própria ocorrência)', async () => {
    const record = buildRecord();
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);

    const error = await rateOccurrence(record.id, gestor, { score: 5 }, { occurrences }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404 });
  });

  it('lança ConflictError quando o status não é RESOLVIDA', async () => {
    const record = buildRecord({ status: 'ABERTA', resolutionNote: null, resolvedAt: null });
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);

    const error = await rateOccurrence(record.id, ana, { score: 5 }, { occurrences }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409 });
  });

  it('lança ConflictError quando a ocorrência já foi avaliada', async () => {
    const record = buildRecord();
    const { repository: occurrences } = createInMemoryOccurrenceRepository([
      { ...record, rating: buildRating() },
    ]);

    const error = await rateOccurrence(record.id, ana, { score: 3 }, { occurrences }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409 });
  });

  it('autor avalia ocorrência RESOLVIDA com comment', async () => {
    const record = buildRecord();
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);

    const rating = await rateOccurrence(
      record.id,
      ana,
      { score: 5, comment: 'Excelente atendimento' },
      { occurrences },
    );

    expect(rating.score).toBe(5);
    expect(rating.comment).toBe('Excelente atendimento');
  });

  it('autor avalia ocorrência RESOLVIDA sem comment', async () => {
    const record = buildRecord();
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);

    const rating = await rateOccurrence(record.id, ana, { score: 2 }, { occurrences });

    expect(rating.score).toBe(2);
    expect(rating.comment).toBeNull();
  });
});
