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

/**
 * `assignedTo` é opcional na entrada: `create()` (`prisma-occurrence-repository.ts`)
 * passa a linha crua do `INSERT`, sem relação nenhuma incluída — mas nesse
 * caso `assignedToId` é sempre `null` (nenhuma ocorrência nasce já atribuída),
 * então `assignedToName` cai em `null` também, sem precisar de join. Quem
 * inclui a relação de verdade é `findById` (via `toOccurrenceDetail`), para
 * ocorrências que já têm um responsável.
 */
type OccurrenceRowWithAssignee = PrismaOccurrence & {
  assignedTo?: { name: string } | null;
};

/**
 * `imageUrl` entra como parâmetro, não como campo lido de `row`: a coluna
 * `Occurrence.imageUrl` deixou de ser escrita na criação (ver
 * `create-occurrence.ts` e `CreateOccurrenceData`) — a URL de leitura é
 * derivada de `row.imageKey` pelo `FileStorage` ativo, e isso exige I/O
 * (uma chamada de rede no adaptador Blob). Calcular isso aqui dentro
 * tornaria esta função assíncrona e dependente de infra, quebrando o que a
 * torna fácil de testar hoje (entrada e saída puras, sem mock de storage).
 * Quem chama (`prisma-occurrence-repository.ts`) resolve a URL antes e passa
 * pronta.
 */
export function toOccurrenceRecord(
  row: OccurrenceRowWithAssignee,
  imageUrl: string | null,
): OccurrenceRecord {
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
    imageUrl,
    imageKey: row.imageKey,
    createdById: row.createdById,
    assignedToId: row.assignedToId,
    assignedToName: row.assignedTo?.name ?? null,
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

/** `changedBy` é relação obrigatória no schema — sempre presente quando `findById` a inclui. */
type StatusHistoryRowWithUser = PrismaStatusHistory & { changedBy: { name: string } };

export function toStatusHistoryEntry(row: StatusHistoryRowWithUser): StatusHistoryEntry {
  return {
    id: row.id,
    fromStatus: row.fromStatus as OccurrenceStatus | null,
    toStatus: row.toStatus as OccurrenceStatus,
    note: row.note,
    changedById: row.changedById,
    changedByName: row.changedBy.name,
    createdAt: row.createdAt,
  };
}

/** `author` é relação obrigatória no schema — sempre presente quando `findById`/`addComment` a incluem. */
type CommentRowWithAuthor = PrismaComment & { author: { name: string } };

export function toCommentEntry(row: CommentRowWithAuthor): CommentEntry {
  return {
    id: row.id,
    occurrenceId: row.occurrenceId,
    authorId: row.authorId,
    authorName: row.author.name,
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
  assignedTo?: { name: string } | null;
  history: StatusHistoryRowWithUser[];
  comments: CommentRowWithAuthor[];
  rating: PrismaRating | null;
};

export function toOccurrenceDetail(
  row: OccurrenceWithRelations,
  imageUrl: string | null,
): OccurrenceDetail {
  return {
    ...toOccurrenceRecord(row, imageUrl),
    history: row.history.map(toStatusHistoryEntry),
    comments: row.comments.map(toCommentEntry),
    rating: row.rating ? toRatingEntry(row.rating) : null,
  };
}
