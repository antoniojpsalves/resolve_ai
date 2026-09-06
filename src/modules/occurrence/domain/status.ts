/**
 * Única lista de todos os status válidos — fonte de verdade de que `OccurrenceStatus`
 * deriva. Qualquer outro lugar do código que precise "todos os status" (schema
 * Zod de filtro, `src/lib/occurrences/status.ts` para a UI) importa esta
 * constante em vez de repetir a lista: um status novo entra aqui uma única
 * vez, e `TRANSITIONS`/`PRIORITY_WEIGHTS` (tipados como `Record<OccurrenceStatus, ...>`)
 * dão erro de compilação até ganhar entrada própria — não há como esquecer
 * silenciosamente.
 */
export const ALL_STATUSES = [
  'ABERTA',
  'EM_ANALISE',
  'EM_ATENDIMENTO',
  'RESOLVIDA',
  'CANCELADA',
] as const;

/** Ciclo de vida de uma ocorrência. */
export type OccurrenceStatus = (typeof ALL_STATUSES)[number];

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
