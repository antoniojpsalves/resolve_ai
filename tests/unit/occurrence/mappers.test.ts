import type {
  Comment as PrismaComment,
  Occurrence as PrismaOccurrence,
  Rating as PrismaRating,
  StatusHistory as PrismaStatusHistory,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  toCommentEntry,
  toOccurrenceDetail,
  toOccurrenceListItem,
  toOccurrenceRecord,
  toRatingEntry,
  toStatusHistoryEntry,
} from '@/modules/occurrence/infra/mappers';

/**
 * `mappers.ts` só rearranja campos — nenhuma dessas funções chama o Prisma,
 * então testá-las com objetos no formato de uma linha do Prisma (sem tocar
 * banco nenhum) é teste unitário de verdade, não de integração. Os tipos
 * `Prisma*` entram só como anotação de tipo dos fixtures, para o TypeScript
 * aceitar os literais `'ABERTA'`/`'MEDIA'` como os enums que o Prisma gera.
 */
const baseOccurrenceRow: PrismaOccurrence = {
  id: 'occ-1',
  code: 'OC-2026-000001',
  title: 'Vazamento na garagem',
  description: 'Água acumulada perto da vaga 12',
  status: 'ABERTA',
  priority: 'MEDIA',
  categoryId: 'cat-hidraulica',
  locationLabel: 'Bloco B, garagem -1',
  latitude: -23.55,
  longitude: -46.63,
  imageUrl: null,
  imageKey: null,
  createdById: 'user-ana',
  assignedToId: null,
  resolutionNote: null,
  resolvedAt: null,
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  updatedAt: new Date('2026-08-01T10:00:00.000Z'),
};

describe('toOccurrenceRecord', () => {
  it('traduz a linha do Prisma para OccurrenceRecord', () => {
    expect(toOccurrenceRecord(baseOccurrenceRow)).toEqual(baseOccurrenceRow);
  });
});

describe('toOccurrenceListItem', () => {
  it('projeta só os campos usados na listagem', () => {
    expect(toOccurrenceListItem(baseOccurrenceRow)).toEqual({
      id: 'occ-1',
      code: 'OC-2026-000001',
      title: 'Vazamento na garagem',
      status: 'ABERTA',
      priority: 'MEDIA',
      categoryId: 'cat-hidraulica',
      locationLabel: 'Bloco B, garagem -1',
      createdById: 'user-ana',
      assignedToId: null,
      createdAt: baseOccurrenceRow.createdAt,
    });
  });
});

describe('toStatusHistoryEntry', () => {
  it('mantém fromStatus null para a entrada de criação', () => {
    const row: PrismaStatusHistory = {
      id: 'hist-1',
      occurrenceId: 'occ-1',
      fromStatus: null,
      toStatus: 'ABERTA',
      note: null,
      changedById: 'user-ana',
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    };

    expect(toStatusHistoryEntry(row)).toEqual({
      id: 'hist-1',
      fromStatus: null,
      toStatus: 'ABERTA',
      note: null,
      changedById: 'user-ana',
      createdAt: row.createdAt,
    });
  });

  it('traduz uma transição com fromStatus preenchido', () => {
    const row: PrismaStatusHistory = {
      id: 'hist-2',
      occurrenceId: 'occ-1',
      fromStatus: 'ABERTA',
      toStatus: 'EM_ANALISE',
      note: 'Em análise',
      changedById: 'user-gestor',
      createdAt: new Date('2026-08-02T10:00:00.000Z'),
    };

    expect(toStatusHistoryEntry(row)).toEqual({
      id: 'hist-2',
      fromStatus: 'ABERTA',
      toStatus: 'EM_ANALISE',
      note: 'Em análise',
      changedById: 'user-gestor',
      createdAt: row.createdAt,
    });
  });
});

describe('toCommentEntry', () => {
  it('traduz a linha do Prisma para CommentEntry', () => {
    const row: PrismaComment = {
      id: 'comment-1',
      occurrenceId: 'occ-1',
      authorId: 'user-ana',
      body: 'Aguardando retorno',
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
    };

    expect(toCommentEntry(row)).toEqual(row);
  });
});

describe('toRatingEntry', () => {
  it('traduz a linha do Prisma para RatingEntry', () => {
    const row: PrismaRating = {
      id: 'rating-1',
      occurrenceId: 'occ-1',
      score: 5,
      comment: 'Ótimo atendimento',
      createdAt: new Date('2026-08-10T10:00:00.000Z'),
    };

    expect(toRatingEntry(row)).toEqual({
      id: 'rating-1',
      score: 5,
      comment: 'Ótimo atendimento',
      createdAt: row.createdAt,
    });
  });
});

describe('toOccurrenceDetail', () => {
  it('combina o record com histórico, comentários e avaliação', () => {
    const historyRow: PrismaStatusHistory = {
      id: 'hist-1',
      occurrenceId: 'occ-1',
      fromStatus: null,
      toStatus: 'ABERTA',
      note: null,
      changedById: 'user-ana',
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    };
    const commentRow: PrismaComment = {
      id: 'comment-1',
      occurrenceId: 'occ-1',
      authorId: 'user-ana',
      body: 'Aguardando retorno',
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
    };
    const ratingRow: PrismaRating = {
      id: 'rating-1',
      occurrenceId: 'occ-1',
      score: 5,
      comment: null,
      createdAt: new Date('2026-08-10T10:00:00.000Z'),
    };

    const detail = toOccurrenceDetail({
      ...baseOccurrenceRow,
      history: [historyRow],
      comments: [commentRow],
      rating: ratingRow,
    });

    expect(detail).toEqual({
      ...baseOccurrenceRow,
      history: [
        {
          id: 'hist-1',
          fromStatus: null,
          toStatus: 'ABERTA',
          note: null,
          changedById: 'user-ana',
          createdAt: historyRow.createdAt,
        },
      ],
      comments: [commentRow],
      rating: { id: 'rating-1', score: 5, comment: null, createdAt: ratingRow.createdAt },
    });
  });

  it('devolve rating null quando a ocorrência não foi avaliada', () => {
    const detail = toOccurrenceDetail({
      ...baseOccurrenceRow,
      history: [],
      comments: [],
      rating: null,
    });

    expect(detail.rating).toBeNull();
    expect(detail.history).toEqual([]);
    expect(detail.comments).toEqual([]);
  });
});
