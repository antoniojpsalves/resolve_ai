import type {
  Comment as PrismaComment,
  Occurrence as PrismaOccurrence,
  Rating as PrismaRating,
  StatusHistory as PrismaStatusHistory,
} from '@prisma/client';

import type { Priority } from '@/modules/occurrence/domain/priority';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

import type {
  CommentEntry,
  OccurrenceDetail,
  OccurrenceListItem,
  OccurrenceRecord,
  RatingEntry,
  StatusHistoryEntry,
} from '../application/ports/occurrence-repository';

/**
 * Funções de mapeamento explícitas Prisma → `application`. Único lugar (além
 * de `prisma-occurrence-repository.ts` e `prisma-category-repository.ts`)
 * onde um tipo gerado pelo Prisma é conhecido — nada daqui vaza para fora de
 * `infra/`.
 */

export function toOccurrenceRecord(row: PrismaOccurrence): OccurrenceRecord {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    status: row.status as OccurrenceStatus,
    priority: row.priority as Priority,
    categoryId: row.categoryId,
    locationLabel: row.locationLabel,
    latitude: row.latitude,
    longitude: row.longitude,
    imageUrl: row.imageUrl,
    imageKey: row.imageKey,
    createdById: row.createdById,
    assignedToId: row.assignedToId,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toOccurrenceListItem(row: PrismaOccurrence): OccurrenceListItem {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status as OccurrenceStatus,
    priority: row.priority as Priority,
    categoryId: row.categoryId,
    locationLabel: row.locationLabel,
    createdById: row.createdById,
    assignedToId: row.assignedToId,
    createdAt: row.createdAt,
  };
}

export function toStatusHistoryEntry(row: PrismaStatusHistory): StatusHistoryEntry {
  return {
    id: row.id,
    fromStatus: row.fromStatus as OccurrenceStatus | null,
    toStatus: row.toStatus as OccurrenceStatus,
    note: row.note,
    changedById: row.changedById,
    createdAt: row.createdAt,
  };
}

export function toCommentEntry(row: PrismaComment): CommentEntry {
  return {
    id: row.id,
    occurrenceId: row.occurrenceId,
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt,
  };
}

export function toRatingEntry(row: PrismaRating): RatingEntry {
  return {
    id: row.id,
    score: row.score,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

type OccurrenceWithRelations = PrismaOccurrence & {
  history: PrismaStatusHistory[];
  comments: PrismaComment[];
  rating: PrismaRating | null;
};

export function toOccurrenceDetail(row: OccurrenceWithRelations): OccurrenceDetail {
  return {
    ...toOccurrenceRecord(row),
    history: row.history.map(toStatusHistoryEntry),
    comments: row.comments.map(toCommentEntry),
    rating: row.rating ? toRatingEntry(row.rating) : null,
  };
}
