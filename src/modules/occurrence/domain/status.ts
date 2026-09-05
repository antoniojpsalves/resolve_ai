/** Ciclo de vida de uma ocorrência. */
export type OccurrenceStatus =
  | 'ABERTA'
  | 'EM_ANALISE'
  | 'EM_ATENDIMENTO'
  | 'RESOLVIDA'
  | 'CANCELADA';

/**
 * Mapa de destinos válidos a partir de cada status. Única fonte de verdade
 * sobre quais pares (de, para) existem — `canTransition` (`transitions.ts`)
 * consulta este mapa antes de checar permissão ou campos obrigatórios.
 */
export const TRANSITIONS: Record<OccurrenceStatus, OccurrenceStatus[]> = {
  ABERTA: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['EM_ATENDIMENTO', 'CANCELADA'],
  EM_ATENDIMENTO: ['RESOLVIDA', 'CANCELADA'],
  RESOLVIDA: [],
  CANCELADA: [],
};

const TERMINAL_STATUSES: readonly OccurrenceStatus[] = ['RESOLVIDA', 'CANCELADA'];

/** `RESOLVIDA` e `CANCELADA` são terminais: nenhuma transição sai delas. */
export function isTerminalStatus(status: OccurrenceStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
