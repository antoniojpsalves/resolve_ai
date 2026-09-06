import type { Priority } from '@/modules/occurrence/domain/priority';

/** Todas as prioridades, da menos para a mais urgente. */
export const ALL_PRIORITIES: readonly Priority[] = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'];

/** Rótulo em português de cada prioridade. */
const PRIORITY_LABELS: Record<Priority, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

/**
 * Classes Tailwind por prioridade. O brief só fixa cor para status — aqui a
 * escala é livre, escolhida para não colidir visualmente com as cores de
 * status (ex.: `URGENTE` usa `rose`, não o mesmo `red` de `CANCELADA`), com o
 * mesmo cuidado de contraste claro/escuro.
 */
const PRIORITY_BADGE_CLASSNAMES: Record<Priority, string> = {
  BAIXA: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  MEDIA: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  ALTA: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  URGENTE: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
};

/** Rótulo em português de uma prioridade. */
export function priorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

/** Classes Tailwind (cor semântica) de uma prioridade, para o badge. */
export function priorityBadgeClassName(priority: Priority): string {
  return PRIORITY_BADGE_CLASSNAMES[priority];
}
