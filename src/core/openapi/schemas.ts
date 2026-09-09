import { z } from 'zod';

import './zod-extend';

import { ALL_PRIORITIES } from '@/modules/occurrence/domain/priority';
import { ALL_STATUSES } from '@/modules/occurrence/domain/status';

/**
 * Schemas de **resposta** deste módulo.
 *
 * Diferente dos schemas de `application/` (que validam requisição em
 * runtime), estes espelham interfaces TypeScript que já existem em
 * `application/ports/*.ts` (`OccurrenceRecord`, `OccurrenceDetail`,
 * `DashboardMetrics`, `PublicUser`, ...) — não há schema Zod de resposta no
 * projeto porque a resposta nunca é validada em runtime, só serializada via
 * `Response.json(...)`. Cada campo aqui foi copiado 1:1 da interface
 * correspondente (comentário aponta o arquivo fonte); nenhum campo foi
 * inventado.
 */

export const roleSchema = z.enum(['SOLICITANTE', 'GESTOR']).openapi('Role');

export const occurrenceStatusSchema = z.enum(ALL_STATUSES).openapi('OccurrenceStatus');

export const prioritySchema = z.enum(ALL_PRIORITIES).openapi('Priority');

/** RFC 7807 problem+json — `src/core/http/problem.ts` (`ProblemDetails`). */
export const problemDetailsSchema = z
  .object({
    type: z.string().openapi({ description: 'URI estável identificando o tipo de erro.' }),
    title: z.string().openapi({ description: 'Resumo curto e estável do tipo de erro.' }),
    status: z.number().int().openapi({ description: 'Status HTTP, repetido no corpo.' }),
    detail: z
      .string()
      .optional()
      .openapi({ description: 'Explicação legível específica desta ocorrência do erro.' }),
    errors: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional()
      .openapi({
        description:
          'Presente apenas quando o erro vem de `ZodError` (payload que não passou na validação do schema) — um item por campo inválido.',
      }),
  })
  .openapi('ProblemDetails');

/** `PublicUser` — `src/modules/identity/domain/user.ts`. */
export const publicUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: roleSchema,
  })
  .openapi('PublicUser');

/** `CategorySummary` — `src/modules/occurrence/application/ports/category-repository.ts`. */
export const categorySummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  })
  .openapi('CategorySummary');

/** `StatusHistoryEntry` — `src/modules/occurrence/application/ports/occurrence-repository.ts`. */
export const statusHistoryEntrySchema = z
  .object({
    id: z.string(),
    fromStatus: occurrenceStatusSchema
      .nullable()
      .openapi({ description: 'null na entrada de criação (não houve status anterior).' }),
    toStatus: occurrenceStatusSchema,
    note: z.string().nullable(),
    changedById: z.string(),
    changedByName: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi('StatusHistoryEntry');

/** `CommentEntry` — `src/modules/occurrence/application/ports/occurrence-repository.ts`. */
export const commentEntrySchema = z
  .object({
    id: z.string(),
    occurrenceId: z.string(),
    authorId: z.string(),
    authorName: z.string(),
    body: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi('CommentEntry');

/** `RatingEntry` — `src/modules/occurrence/application/ports/occurrence-repository.ts`. */
export const ratingEntrySchema = z
  .object({
    id: z.string(),
    score: z.number().int().min(1).max(5),
    comment: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('RatingEntry');

/** `OccurrenceRecord` — `src/modules/occurrence/application/ports/occurrence-repository.ts`. */
export const occurrenceRecordSchema = z
  .object({
    id: z.string(),
    code: z.string().openapi({ example: 'OC-2026-000123' }),
    title: z.string(),
    description: z.string(),
    status: occurrenceStatusSchema,
    priority: prioritySchema,
    categoryId: z.string(),
    categoryName: z.string(),
    locationLabel: z.string(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    imageUrl: z
      .string()
      .nullable()
      .openapi({ description: 'Derivada de `imageKey` pelo storage ativo; null se não houver.' }),
    imageKey: z.string().nullable(),
    createdById: z.string(),
    assignedToId: z.string().nullable(),
    assignedToName: z.string().nullable(),
    resolutionNote: z.string().nullable(),
    resolvedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('OccurrenceRecord');

/** `OccurrenceListItem` — recorte mais leve usado por `GET /occurrences`. */
export const occurrenceListItemSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    title: z.string(),
    status: occurrenceStatusSchema,
    priority: prioritySchema,
    categoryId: z.string(),
    categoryName: z.string(),
    locationLabel: z.string(),
    createdById: z.string(),
    assignedToId: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('OccurrenceListItem');

/** `OccurrenceDetail extends OccurrenceRecord` — `GET /occurrences/{id}`. */
export const occurrenceDetailSchema = occurrenceRecordSchema
  .extend({
    history: z.array(statusHistoryEntrySchema),
    comments: z.array(commentEntrySchema),
    rating: ratingEntrySchema.nullable(),
  })
  .openapi('OccurrenceDetail');

/** `ListOccurrencesOutput` — `application/list-occurrences.ts`. */
export const listOccurrencesResponseSchema = z
  .object({
    data: z.array(occurrenceListItemSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  })
  .openapi('ListOccurrencesResponse');

/** `StoredFile` — `application/ports/file-storage.ts`, resposta de `POST /uploads`. */
export const storedFileSchema = z
  .object({
    url: z.string(),
    key: z.string(),
  })
  .openapi('StoredFile');

/** `DashboardMetrics` — `application/ports/dashboard-repository.ts`. */
export const dashboardMetricsSchema = z
  .object({
    totalByStatus: z.array(z.object({ status: occurrenceStatusSchema, count: z.number().int() })),
    totalByCategory: z.array(
      z.object({ categoryId: z.string(), categoryName: z.string(), count: z.number().int() }),
    ),
    totalByPriority: z.array(z.object({ priority: prioritySchema, count: z.number().int() })),
    overdueCount: z.number().int(),
    overdueDays: z.number().int(),
    averageResolutionHours: z
      .number()
      .nullable()
      .openapi({ description: 'null quando nenhuma ocorrência foi resolvida ainda.' }),
    timeSeries: z.array(
      z.object({
        date: z.string().openapi({ description: 'YYYY-MM-DD, UTC.', example: '2026-01-31' }),
        opened: z.number().int(),
        resolved: z.number().int(),
      }),
    ),
    topResponsibles: z.array(
      z.object({ userId: z.string(), userName: z.string(), count: z.number().int() }),
    ),
    averageRating: z
      .number()
      .nullable()
      .openapi({ description: 'null quando nenhuma avaliação existe ainda.' }),
  })
  .openapi('DashboardMetrics');

/** Resposta de `GET /api/v1/health`. */
export const healthResponseSchema = z
  .object({
    status: z.literal('ok'),
    db: z.literal('up'),
    timestamp: z.string().datetime(),
  })
  .openapi('HealthResponse');
