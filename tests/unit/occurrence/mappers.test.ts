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
  it('traduz a linha do Prisma para OccurrenceRecord, assignedToName null sem relação incluída', () => {
    // `create()` (prisma-occurrence-repository.ts) chama esta função sem
    // incluir a relação `assignedTo` — não precisa, `assignedToId` é sempre
    // null na criação. `assignedToName` cai em null sem exigir join.
    expect(toOccurrenceRecord(baseOccurrenceRow)).toEqual({
      ...baseOccurrenceRow,
      assignedToName: null,
    });
  });

  it('resolve assignedToName a partir da relação assignedTo, quando incluída', () => {
    const row = {
      ...baseOccurrenceRow,
      assignedToId: 'user-gestor',
      assignedTo: { name: 'Gestor de Teste' },
    };

    expect(toOccurrenceRecord(row).assignedToName).toBe('Gestor de Teste');
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
    const row: PrismaStatusHistory & { changedBy: { name: string } } = {
      id: 'hist-1',
      occurrenceId: 'occ-1',
      fromStatus: null,
      toStatus: 'ABERTA',
      note: null,
      changedById: 'user-ana',
      changedBy: { name: 'Ana Paula Ribeiro' },
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    };

    expect(toStatusHistoryEntry(row)).toEqual({
      id: 'hist-1',
      fromStatus: null,
      toStatus: 'ABERTA',
      note: null,
      changedById: 'user-ana',
      changedByName: 'Ana Paula Ribeiro',
      createdAt: row.createdAt,
    });
  });

  it('traduz uma transição com fromStatus preenchido', () => {
    const row: PrismaStatusHistory & { changedBy: { name: string } } = {
      id: 'hist-2',
      occurrenceId: 'occ-1',
      fromStatus: 'ABERTA',
      toStatus: 'EM_ANALISE',
      note: 'Em análise',
      changedById: 'user-gestor',
      changedBy: { name: 'Gestor de Teste' },
      createdAt: new Date('2026-08-02T10:00:00.000Z'),
    };

    expect(toStatusHistoryEntry(row)).toEqual({
      id: 'hist-2',
      fromStatus: 'ABERTA',
      toStatus: 'EM_ANALISE',
      note: 'Em análise',
      changedById: 'user-gestor',
      changedByName: 'Gestor de Teste',
      createdAt: row.createdAt,
    });
  });
});

describe('toCommentEntry', () => {
  it('traduz a linha do Prisma para CommentEntry', () => {
    const row: PrismaComment & { author: { name: string } } = {
      id: 'comment-1',
      occurrenceId: 'occ-1',
      authorId: 'user-ana',
      author: { name: 'Ana Paula Ribeiro' },
      body: 'Aguardando retorno',
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
    };

    expect(toCommentEntry(row)).toEqual({
      id: 'comment-1',
      occurrenceId: 'occ-1',
      authorId: 'user-ana',
      authorName: 'Ana Paula Ribeiro',
      body: 'Aguardando retorno',
      createdAt: row.createdAt,
    });
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
  it('combina o record com histórico, comentários e avaliação, com nomes resolvidos', () => {
    const historyRow = {
      id: 'hist-1',
      occurrenceId: 'occ-1',
      fromStatus: null,
      toStatus: 'ABERTA' as const,
      note: null,
      changedById: 'user-ana',
      changedBy: { name: 'Ana Paula Ribeiro' },
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    };
    const commentRow = {
      id: 'comment-1',
      occurrenceId: 'occ-1',
      authorId: 'user-ana',
      author: { name: 'Ana Paula Ribeiro' },
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
      assignedToId: 'user-gestor',
      assignedTo: { name: 'Gestor de Teste' },
      history: [historyRow],
      comments: [commentRow],
      rating: ratingRow,
    });

    expect(detail).toEqual({
      ...baseOccurrenceRow,
      assignedToId: 'user-gestor',
      assignedToName: 'Gestor de Teste',
      history: [
        {
          id: 'hist-1',
          fromStatus: null,
          toStatus: 'ABERTA',
          note: null,
          changedById: 'user-ana',
          changedByName: 'Ana Paula Ribeiro',
          createdAt: historyRow.createdAt,
        },
      ],
      comments: [
        {
          id: 'comment-1',
          occurrenceId: 'occ-1',
          authorId: 'user-ana',
          authorName: 'Ana Paula Ribeiro',
          body: 'Aguardando retorno',
          createdAt: commentRow.createdAt,
        },
      ],
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
    expect(detail.assignedToName).toBeNull();
    expect(detail.history).toEqual([]);
    expect(detail.comments).toEqual([]);
  });
});
