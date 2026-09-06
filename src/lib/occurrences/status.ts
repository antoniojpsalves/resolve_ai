import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

/**
 * Todos os status, na ordem do ciclo de vida — usada para popular filtros e
 * para testar exaustividade dos mapas abaixo.
 */
export const ALL_STATUSES: readonly OccurrenceStatus[] = [
  'ABERTA',
  'EM_ANALISE',
  'EM_ATENDIMENTO',
  'RESOLVIDA',
  'CANCELADA',
];

/** Rótulo em português de cada status — única fonte de verdade para exibição. */
const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em análise',
  EM_ATENDIMENTO: 'Em atendimento',
  RESOLVIDA: 'Resolvida',
  CANCELADA: 'Cancelada',
};

/**
 * Classes Tailwind por status — azul / âmbar / índigo / verde / vermelho,
 * exatamente as cores do fluxograma do enunciado (item do brief da Tarefa 4).
 * O par `-100`/`-800` cobre o tema claro e `-500/15` + `-300` o escuro, os
 * dois com contraste de texto legível — a cor nunca é o único indicador de
 * status, o rótulo textual (`statusLabel`) sempre acompanha.
 */
const STATUS_BADGE_CLASSNAMES: Record<OccurrenceStatus, string> = {
  ABERTA: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  EM_ANALISE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  EM_ATENDIMENTO: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
  RESOLVIDA: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  CANCELADA: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
};

/** Rótulo em português de um status. */
export function statusLabel(status: OccurrenceStatus): string {
  return STATUS_LABELS[status];
}

/** Classes Tailwind (cor semântica) de um status, para o badge. */
export function statusBadgeClassName(status: OccurrenceStatus): string {
  return STATUS_BADGE_CLASSNAMES[status];
}
