/** Prioridade de atendimento de uma ocorrência. */
export type Priority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

/**
 * Peso numérico de cada prioridade, para ordenação estável do backlog
 * quanto maior o peso, mais urgente. `URGENTE > ALTA > MEDIA > BAIXA`.
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
