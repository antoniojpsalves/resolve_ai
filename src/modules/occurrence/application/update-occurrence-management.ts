import { z } from 'zod';

import { ALL_PRIORITIES } from '@/modules/occurrence/domain/priority';

/**
 * Schema do `PATCH /api/v1/occurrences/[id]` — não existe um único use-case
 * "PATCH": `priority` e `assignedToId` disparam dois use-cases separados
 * (`updateOccurrencePriority`/`assignOccurrenceResponsible`), então este
 * módulo só existe para manter `src/app/` livre de `z.object`, seguindo o
 * precedente de `createOccurrenceSchema`/`changeOccurrenceStatusSchema`
 * (que moram junto do use-case, em `application/`).
 */
export const updateOccurrenceManagementSchema = z
  .object({
    priority: z.enum(ALL_PRIORITIES).optional(),
    assignedToId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((data) => data.priority !== undefined || data.assignedToId !== undefined, {
    message: 'Informe ao menos prioridade ou responsável.',
  });

export type UpdateOccurrenceManagementInput = z.infer<typeof updateOccurrenceManagementSchema>;
