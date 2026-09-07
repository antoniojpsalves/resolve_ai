import { z } from 'zod';

import { ALL_PRIORITIES } from '@/modules/occurrence/domain/priority';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { ALL_STATUSES } from '@/modules/occurrence/domain/status';

import type { ListOccurrencesResult, OccurrenceRepository } from './ports/occurrence-repository';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const listOccurrencesQuerySchema = z
  .object({
    status: z.enum(ALL_STATUSES).optional(),
    categoryId: z.string().trim().min(1).optional(),
    priority: z.enum(ALL_PRIORITIES).optional(),
    q: z.string().trim().min(1).optional(),
    assignedToId: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strip();

export type ListOccurrencesQueryInput = z.infer<typeof listOccurrencesQuerySchema>;

export interface ListOccurrencesDeps {
  occurrences: OccurrenceRepository;
}

export interface ListOccurrencesOutput extends ListOccurrencesResult {
  page: number;
  pageSize: number;
}

/**
 * Lista ocorrências com filtros, ordenação (`createdAt` desc) e paginação.
 *
 * Escopo por perfil — regra de segurança, não de UI: `GESTOR` vê todas;
 * `SOLICITANTE` vê apenas as próprias (`createdById === actor.id`). O recorte
 * é aplicado aqui, sobrescrevendo qualquer tentativa de o solicitante ver
 * ocorrência de outra pessoa — inclusive combinando com `assignedToId` de
 * outra pessoa, que continua ANDado com o próprio `createdById` e portanto
 * nunca escapa do recorte.
 */
export async function listOccurrences(
  input: ListOccurrencesQueryInput,
  actor: Actor,
  { occurrences }: ListOccurrencesDeps,
): Promise<ListOccurrencesOutput> {
  const scopedCreatedById = actor.role === 'SOLICITANTE' ? actor.id : undefined;

  const result = await occurrences.list({
    status: input.status,
    categoryId: input.categoryId,
    priority: input.priority,
    q: input.q,
    assignedToId: input.assignedToId,
    createdById: scopedCreatedById,
    page: input.page,
    pageSize: input.pageSize,
  });

  return { ...result, page: input.page, pageSize: input.pageSize };
}
