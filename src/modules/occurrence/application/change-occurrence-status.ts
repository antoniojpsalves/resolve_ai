import { z } from 'zod';

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/core/errors';
import { canTransition } from '@/modules/occurrence/domain/transitions';
import type { TransitionDenial } from '@/modules/occurrence/domain/transitions';
import { canViewOccurrence } from '@/modules/occurrence/domain/permissions';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { ALL_STATUSES } from '@/modules/occurrence/domain/status';

import type { OccurrenceRecord, OccurrenceRepository } from './ports/occurrence-repository';
import { toDomainOccurrence } from './to-domain-occurrence';

export const changeOccurrenceStatusSchema = z
  .object({
    toStatus: z.enum(ALL_STATUSES),
    note: z.string().trim().min(1).optional(),
    resolutionNote: z.string().trim().min(1).optional(),
  })
  .strict();

export type ChangeOccurrenceStatusInput = z.infer<typeof changeOccurrenceStatusSchema>;

export interface ChangeOccurrenceStatusDeps {
  occurrences: OccurrenceRepository;
}

/**
 * Tabela de mapeamento `TransitionDenial` → `AppError`, já decidida (ver
 * brief da tarefa — não é para reinventar aqui). Mensagens curtas e diretas,
 * o `detail` de cada erro completa o contexto.
 */
function errorForDenial(reason: TransitionDenial): Error {
  switch (reason) {
    case 'STATUS_TERMINAL':
      return new ConflictError('Esta ocorrência já está num status final', {
        detail: 'Ocorrências RESOLVIDA ou CANCELADA não aceitam novas mudanças de status.',
      });
    case 'TRANSICAO_INVALIDA':
      return new ConflictError('Não é possível ir de um status para o outro', {
        detail: 'A transição solicitada não é permitida a partir do status atual.',
      });
    case 'PERMISSAO_NEGADA':
      return new ForbiddenError('Você não tem permissão para essa mudança de status');
    case 'OBSERVACAO_OBRIGATORIA':
      return new ValidationError('Observação obrigatória para cancelar', {
        detail: 'Informe `note` explicando o motivo do cancelamento.',
      });
    case 'SOLUCAO_OBRIGATORIA':
      return new ValidationError('Solução obrigatória para resolver', {
        detail: 'Informe `resolutionNote` descrevendo a solução aplicada.',
      });
  }
}

/**
 * Muda o status de uma ocorrência, aplicando a máquina de estados de
 * `domain/transitions.ts` (`canTransition`, congelada nesta tarefa).
 *
 * Autorização em duas camadas, igual `getOccurrence`/`addComment`:
 *  1. `canViewOccurrence` primeiro — ocorrência inexistente OU que o ator nem
 *     pode ver vira `NotFoundError` (404). Um solicitante pedindo mudança de
 *     status de ocorrência de outra pessoa nunca aprende, pela resposta, que
 *     ela existe (mesmo response de "não existe").
 *  2. Só então `canTransition` decide o resto — inclui a checagem de
 *     permissão da transição em si (`PERMISSAO_NEGADA`, ex.: solicitante
 *     tentando algo além de cancelar a própria ocorrência ABERTA), mapeada
 *     para os `AppError` de `errorForDenial` acima.
 */
export async function changeOccurrenceStatus(
  id: string,
  actor: Actor,
  input: ChangeOccurrenceStatusInput,
  { occurrences }: ChangeOccurrenceStatusDeps,
): Promise<OccurrenceRecord> {
  const detail = await occurrences.findById(id);

  if (!detail || !canViewOccurrence(actor, toDomainOccurrence(detail))) {
    throw new NotFoundError('Ocorrência não encontrada');
  }

  const domainOccurrence = toDomainOccurrence(detail);

  const check = canTransition(detail.status, input.toStatus, actor, domainOccurrence, {
    note: input.note,
    resolutionNote: input.resolutionNote,
  });

  if (!check.allowed) {
    throw errorForDenial(check.reason);
  }

  return occurrences.changeStatus(id, {
    fromStatus: detail.status,
    toStatus: input.toStatus,
    note: input.note,
    resolutionNote: input.resolutionNote,
    changedById: actor.id,
  });
}
