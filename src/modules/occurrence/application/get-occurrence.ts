import { NotFoundError } from '@/core/errors';
import { canViewOccurrence } from '@/modules/occurrence/domain/permissions';
import type { Actor } from '@/modules/occurrence/domain/occurrence';

import type { OccurrenceDetail, OccurrenceRepository } from './ports/occurrence-repository';
import { toDomainOccurrence } from './to-domain-occurrence';

export interface GetOccurrenceDeps {
  occurrences: OccurrenceRepository;
}

/**
 * Busca o detalhe de uma ocorrência: dados completos, histórico (ordem
 * cronológica crescente), comentários (ordem cronológica crescente) e
 * avaliação, se houver — a ordenação já vem assim de
 * `OccurrenceRepository.findById` (ver `prisma-occurrence-repository.ts`).
 *
 * Autorização por `canViewOccurrence`. Ocorrência inexistente e ocorrência
 * que existe mas o ator não pode ver (ex.: solicitante pedindo a de outra
 * pessoa) resultam no mesmo `NotFoundError` (404) — de propósito: um 403
 * aqui confirmaria a quem não deveria saber que a ocorrência existe (a mera
 * distinção da resposta já seria um vazamento de informação por enumeração
 * de IDs). Os dois casos precisam ficar indistinguíveis para quem pergunta.
 */
export async function getOccurrence(
  id: string,
  actor: Actor,
  { occurrences }: GetOccurrenceDeps,
): Promise<OccurrenceDetail> {
  const detail = await occurrences.findById(id);

  if (!detail || !canViewOccurrence(actor, toDomainOccurrence(detail))) {
    throw new NotFoundError('Ocorrência não encontrada');
  }

  return detail;
}
