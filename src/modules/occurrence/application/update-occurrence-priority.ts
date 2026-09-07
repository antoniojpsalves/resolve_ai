import { ForbiddenError, NotFoundError } from '@/core/errors';
import { canChangePriority } from '@/modules/occurrence/domain/permissions';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import type { Priority } from '@/modules/occurrence/domain/priority';

import type { OccurrenceRecord, OccurrenceRepository } from './ports/occurrence-repository';
import { toDomainOccurrence } from './to-domain-occurrence';

export interface UpdateOccurrencePriorityDeps {
  occurrences: OccurrenceRepository;
}

/**
 * Muda a prioridade de uma ocorrência.
 *
 * Diferente de `changeOccurrenceStatus`, não há checagem de visibilidade em
 * duas camadas aqui: `canChangePriority` só libera `GESTOR`, e gestor enxerga
 * toda ocorrência que existe — não há caso de "ocorrência de outra pessoa" a
 * esconder atrás de um 404 uniforme.
 */
export async function updateOccurrencePriority(
  id: string,
  actor: Actor,
  priority: Priority,
  { occurrences }: UpdateOccurrencePriorityDeps,
): Promise<OccurrenceRecord> {
  const detail = await occurrences.findById(id);

  if (!detail) {
    throw new NotFoundError('Ocorrência não encontrada');
  }

  if (!canChangePriority(actor, toDomainOccurrence(detail))) {
    throw new ForbiddenError('Você não tem permissão para mudar a prioridade desta ocorrência');
  }

  return occurrences.updatePriority(id, priority);
}
