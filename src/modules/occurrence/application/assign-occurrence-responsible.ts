import { ForbiddenError, NotFoundError } from '@/core/errors';
import type { UserRepository } from '@/modules/identity/application/ports/user-repository';
import { canAssignResponsible } from '@/modules/occurrence/domain/permissions';
import type { Actor } from '@/modules/occurrence/domain/occurrence';

import type { OccurrenceRecord, OccurrenceRepository } from './ports/occurrence-repository';
import { toDomainOccurrence } from './to-domain-occurrence';

export interface AssignOccurrenceResponsibleDeps {
  occurrences: OccurrenceRepository;
  users: UserRepository;
}

/**
 * Atribui (ou remove) o responsável por uma ocorrência.
 *
 * Mesma ausência de checagem de visibilidade em duas camadas de
 * `updateOccurrencePriority` — `canAssignResponsible` só libera `GESTOR`, que
 * enxerga toda ocorrência.
 *
 * `userId === null` desatribui e não passa por nenhuma checagem extra —
 * sempre válido. `userId` não nulo precisa apontar para um usuário existente
 * **e** com papel `GESTOR`: regra de produto (não estava explícita no plano),
 * porque "responsável" é sempre alguém da equipe que atende a ocorrência,
 * nunca o solicitante que a abriu — um `SOLICITANTE` válido como `userId` vira
 * o mesmo 404 de "responsável inválido" que um `id` inexistente, para não
 * vazar por status code se o id pertence a alguém que existe mas não serve.
 */
export async function assignOccurrenceResponsible(
  id: string,
  actor: Actor,
  userId: string | null,
  { occurrences, users }: AssignOccurrenceResponsibleDeps,
): Promise<OccurrenceRecord> {
  const detail = await occurrences.findById(id);

  if (!detail) {
    throw new NotFoundError('Ocorrência não encontrada');
  }

  if (!canAssignResponsible(actor, toDomainOccurrence(detail))) {
    throw new ForbiddenError('Você não tem permissão para atribuir responsável a esta ocorrência');
  }

  if (userId !== null) {
    const responsible = await users.findById(userId);

    if (!responsible || responsible.role !== 'GESTOR') {
      throw new NotFoundError('Responsável inválido', {
        detail: 'O responsável precisa ser um usuário existente com papel GESTOR.',
      });
    }
  }

  return occurrences.assignResponsible(id, userId);
}
