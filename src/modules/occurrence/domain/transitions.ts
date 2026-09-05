import { isAuthor } from './occurrence';
import type { Actor, Occurrence } from './occurrence';
import { isTerminalStatus, TRANSITIONS } from './status';
import type { OccurrenceStatus } from './status';

/** Motivo de negação de uma transição — na ordem em que são checados. */
export type TransitionDenial =
  | 'TRANSICAO_INVALIDA' // o par (de, para) não existe em TRANSITIONS
  | 'STATUS_TERMINAL' // origem é terminal
  | 'PERMISSAO_NEGADA' // o ator não pode fazer essa transição
  | 'OBSERVACAO_OBRIGATORIA' // falta `note`
  | 'SOLUCAO_OBRIGATORIA'; // falta `resolutionNote`

export type TransitionCheck = { allowed: true } | { allowed: false; reason: TransitionDenial };

type TransitionInput = {
  note?: string;
  resolutionNote?: string;
};

/** `note`/`resolutionNote` só contam como presentes se não forem vazias ou só espaços. */
function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Quem pode executar o par (from, to). Regra do enunciado: gestor pode todas
 * as transições válidas; a única exceção para SOLICITANTE é o próprio autor
 * cancelando sua ocorrência ainda ABERTA.
 */
function isAuthorized(
  from: OccurrenceStatus,
  to: OccurrenceStatus,
  actor: Actor,
  occurrence: Occurrence,
): boolean {
  if (actor.role === 'GESTOR') {
    return true;
  }

  if (from === 'ABERTA' && to === 'CANCELADA') {
    return isAuthor(actor, occurrence);
  }

  return false;
}

/** Campo obrigatório faltando para o destino, se houver. */
function missingRequiredField(
  to: OccurrenceStatus,
  input: TransitionInput,
): TransitionDenial | undefined {
  if (to === 'CANCELADA' && !hasText(input.note)) {
    return 'OBSERVACAO_OBRIGATORIA';
  }

  if (to === 'RESOLVIDA' && !hasText(input.resolutionNote)) {
    return 'SOLUCAO_OBRIGATORIA';
  }

  return undefined;
}

/**
 * Decide se a transição (from -> to) é permitida para `actor` sobre
 * `occurrence`, dado `input`. Precedência das negativas — importa para a
 * mensagem que o usuário vê: status terminal → transição inválida →
 * permissão → campo obrigatório.
 */
export function canTransition(
  from: OccurrenceStatus,
  to: OccurrenceStatus,
  actor: Actor,
  occurrence: Occurrence,
  input: TransitionInput,
): TransitionCheck {
  if (isTerminalStatus(from)) {
    return { allowed: false, reason: 'STATUS_TERMINAL' };
  }

  if (!TRANSITIONS[from].includes(to)) {
    return { allowed: false, reason: 'TRANSICAO_INVALIDA' };
  }

  if (!isAuthorized(from, to, actor, occurrence)) {
    return { allowed: false, reason: 'PERMISSAO_NEGADA' };
  }

  const missingField = missingRequiredField(to, input);
  if (missingField) {
    return { allowed: false, reason: missingField };
  }

  // EM_ANALISE -> EM_ATENDIMENTO: ter um responsável atribuído é
  // recomendável, mas não é regra — a checagem de `assignedToId` é
  // deliberadamente ausente aqui.

  return { allowed: true };
}
