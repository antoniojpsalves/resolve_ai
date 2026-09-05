import type { Actor, Occurrence } from './occurrence';

/** O autor é quem abriu a ocorrência. */
function isAuthor(actor: Actor, occurrence: Occurrence): boolean {
  return actor.id === occurrence.createdById;
}

/** Gestor vê todas as ocorrências; solicitante só as próprias. */
export function canViewOccurrence(actor: Actor, occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR' || isAuthor(actor, occurrence);
}

/** Gestor comenta em todas as ocorrências; solicitante só nas próprias. */
export function canCommentOccurrence(actor: Actor, occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR' || isAuthor(actor, occurrence);
}

// As três funções abaixo recebem `occurrence` para manter a mesma assinatura
// `(actor, occurrence)` das demais funções deste módulo (uniformidade para
// quem consome — os use-cases do Dia 2/3), mesmo sem usar o parâmetro hoje.

/** Só gestor muda a prioridade de uma ocorrência. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canChangePriority(actor: Actor, occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR';
}

/** Só gestor atribui responsável a uma ocorrência. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canAssignResponsible(actor: Actor, occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR';
}

/** Só gestor registra a solução de uma ocorrência. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canRegisterResolution(actor: Actor, occurrence: Occurrence): boolean {
  return actor.role === 'GESTOR';
}

/** Só o autor avalia, e só depois que a ocorrência está RESOLVIDA. */
export function canRateOccurrence(actor: Actor, occurrence: Occurrence): boolean {
  return isAuthor(actor, occurrence) && occurrence.status === 'RESOLVIDA';
}
