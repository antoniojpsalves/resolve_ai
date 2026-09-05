import type { Occurrence } from '@/modules/occurrence/domain/occurrence';

import type { OccurrenceRecord } from './ports/occurrence-repository';

/**
 * Projeta um `OccurrenceRecord` (ou `OccurrenceDetail`, que o estende) para o
 * `Occurrence` mínimo que as funções de `domain/permissions.ts` e
 * `domain/transitions.ts` esperam — evita duplicar a seleção de campos em
 * cada use-case que precisa checar permissão.
 */
export function toDomainOccurrence(record: OccurrenceRecord): Occurrence {
  return {
    id: record.id,
    code: record.code,
    status: record.status,
    priority: record.priority,
    createdById: record.createdById,
    assignedToId: record.assignedToId ?? undefined,
    resolutionNote: record.resolutionNote ?? undefined,
  };
}
