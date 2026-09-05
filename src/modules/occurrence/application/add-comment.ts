import { z } from 'zod';

import { NotFoundError } from '@/core/errors';
import { canCommentOccurrence } from '@/modules/occurrence/domain/permissions';
import type { Actor } from '@/modules/occurrence/domain/occurrence';

import type { CommentEntry, OccurrenceRepository } from './ports/occurrence-repository';
import { toDomainOccurrence } from './to-domain-occurrence';

export const addCommentSchema = z
  .object({
    body: z.string().trim().min(1, 'O comentário não pode ser vazio'),
  })
  .strip();

export type AddCommentInput = z.infer<typeof addCommentSchema>;

export interface AddCommentDeps {
  occurrences: OccurrenceRepository;
}

/**
 * Adiciona um comentário a uma ocorrência.
 *
 * Autorização por `canCommentOccurrence` — mesma regra de 404 de
 * `get-occurrence.ts`: ocorrência inexistente e ocorrência que existe mas o
 * ator não pode comentar (ex.: solicitante tentando comentar na de outra
 * pessoa) resultam no mesmo `NotFoundError`, para não confirmar a existência
 * do recurso a quem não deveria vê-lo.
 */
export async function addComment(
  occurrenceId: string,
  input: AddCommentInput,
  actor: Actor,
  { occurrences }: AddCommentDeps,
): Promise<CommentEntry> {
  const detail = await occurrences.findById(occurrenceId);

  if (!detail || !canCommentOccurrence(actor, toDomainOccurrence(detail))) {
    throw new NotFoundError('Ocorrência não encontrada');
  }

  return occurrences.addComment({
    occurrenceId,
    authorId: actor.id,
    body: input.body,
  });
}
