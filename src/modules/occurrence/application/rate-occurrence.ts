import { z } from 'zod';

import { ConflictError, NotFoundError } from '@/core/errors';
import { isAuthor } from '@/modules/occurrence/domain/occurrence';
import type { Actor } from '@/modules/occurrence/domain/occurrence';

import { OccurrenceAlreadyRatedError, type RatingEntry } from './ports/occurrence-repository';
import type { OccurrenceRepository } from './ports/occurrence-repository';
import { toDomainOccurrence } from './to-domain-occurrence';

export const rateOccurrenceSchema = z
  .object({
    score: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).optional(),
  })
  .strict();

export type RateOccurrenceInput = z.infer<typeof rateOccurrenceSchema>;

export interface RateOccurrenceDeps {
  occurrences: OccurrenceRepository;
}

/**
 * Registra a avaliação do solicitante sobre uma ocorrência já resolvida.
 *
 * Autorização em ordem exata (decidida no ledger do projeto, não é para
 * reinventar aqui) — **não** usa `canRateOccurrence` (`domain/permissions.ts`)
 * diretamente: aquela função combina autor + status num único booleano, e
 * este use-case precisa distinguir os dois casos de negação para responder
 * com o status HTTP certo:
 *
 *  1. `findById` não encontra → `NotFoundError` (404).
 *  2. Não é o autor → `NotFoundError` (404), mesmo padrão uniforme de
 *     `getOccurrence`/`changeOccurrenceStatus`: quem não é o autor não
 *     deveria aprender, pela resposta, que a ocorrência existe. Um GESTOR
 *     tentando avaliar cai neste ramo também — gestor nunca é autor da
 *     própria ocorrência que gerencia, salvo o caso degenerado de tê-la
 *     aberto como solicitante, e nesse caso ele É o autor e pode avaliar.
 *  3. Status diferente de `RESOLVIDA` → `ConflictError` (409): aqui já
 *     sabemos que o ator é o dono (não há mais o que esconder), então o erro
 *     é sobre o *estado* não permitir a ação agora, não sobre permissão.
 *  4. Já avaliada (`detail.rating !== null`) → `ConflictError` (409): checagem
 *     "rápida" que evita a viagem ao banco de um `create` que já se sabe que
 *     vai falhar. `OccurrenceAlreadyRatedError`, lançado pela implementação
 *     Prisma quando a checagem 4 perde a corrida (dois `POST` simultâneos
 *     passando os dois por ela antes de qualquer um confirmar o `create`), é
 *     capturado aqui e traduzido para o mesmo `ConflictError` — rede de
 *     segurança, não a primeira defesa.
 */
export async function rateOccurrence(
  id: string,
  actor: Actor,
  input: RateOccurrenceInput,
  { occurrences }: RateOccurrenceDeps,
): Promise<RatingEntry> {
  const detail = await occurrences.findById(id);

  if (!detail) {
    throw new NotFoundError('Ocorrência não encontrada');
  }

  if (!isAuthor(actor, toDomainOccurrence(detail))) {
    throw new NotFoundError('Ocorrência não encontrada');
  }

  if (detail.status !== 'RESOLVIDA') {
    throw new ConflictError('Só é possível avaliar uma ocorrência resolvida.');
  }

  if (detail.rating !== null) {
    throw new ConflictError('Esta ocorrência já foi avaliada.');
  }

  try {
    return await occurrences.rate(id, { score: input.score, comment: input.comment });
  } catch (error) {
    if (error instanceof OccurrenceAlreadyRatedError) {
      throw new ConflictError('Esta ocorrência já foi avaliada.');
    }

    throw error;
  }
}
