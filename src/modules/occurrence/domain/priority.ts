/**
 * Única lista de todas as prioridades válidas, da menos para a mais urgente —
 * fonte de verdade de que `Priority` deriva. Mesma convenção de
 * `domain/status.ts`: um valor novo entra aqui uma vez só, e `PRIORITY_WEIGHTS`
 * (tipado como `Record<Priority, number>`) obriga a dar peso a ele antes de
 * compilar.
 */
export const ALL_PRIORITIES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const;

/** Prioridade de atendimento de uma ocorrência. */
export type Priority = (typeof ALL_PRIORITIES)[number];

/**
 * Peso numérico de cada prioridade, para ordenação estável do backlog
 * (Dia 3): quanto maior o peso, mais urgente. `URGENTE > ALTA > MEDIA > BAIXA`.
 */
const PRIORITY_WEIGHTS: Record<Priority, number> = {
  BAIXA: 0,
  MEDIA: 1,
  ALTA: 2,
  URGENTE: 3,
};

export function priorityWeight(priority: Priority): number {
  return PRIORITY_WEIGHTS[priority];
}
