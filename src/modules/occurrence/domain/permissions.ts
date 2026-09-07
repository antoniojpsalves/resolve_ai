import { isAuthor } from './occurrence';
import type { Actor, Occurrence } from './occurrence';

/** Gestor vê todas as ocorrências; solicitante só as próprias. */
export function canViewOccurrence(actor: Actor, occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR' || isAuthor(actor, occurrence);
}

/** Gestor comenta em todas as ocorrências; solicitante só nas próprias. */
export function canCommentOccurrence(actor: Actor, occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR' || isAuthor(actor, occurrence);
}

// As três funções abaixo recebem `_occurrence` para manter a mesma assinatura
// `(actor, occurrence)` das demais funções deste módulo — quem consome uma
// regra de permissão não deveria precisar saber quais delas usam a
// ocorrência e quais só usam o ator, então todas têm a mesma forma, mesmo
// sem usar o parâmetro hoje. O prefixo `_` sinaliza a não utilização
// intencional sem precisar de `eslint-disable`.

/** Só gestor muda a prioridade de uma ocorrência. */
export function canChangePriority(actor: Actor, _occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR';
}

/** Só gestor atribui responsável a uma ocorrência. */
export function canAssignResponsible(actor: Actor, _occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR';
}

/** Só gestor registra a solução de uma ocorrência. */
export function canRegisterResolution(actor: Actor, _occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR';
}

/** Só o autor avalia, e só depois que a ocorrência está RESOLVIDA. */
export function canRateOccurrence(actor: Actor, occurrence: Occurrence): boolean {
  return isAuthor(actor, occurrence) && occurrence.status === 'RESOLVIDA';
}
