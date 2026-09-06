import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

/** Recorte mínimo de `StatusHistoryEntry` que a derivação da timeline precisa. */
export interface TimelineHistoryLike {
  id: string;
  fromStatus: OccurrenceStatus | null;
  toStatus: OccurrenceStatus;
  note: string | null;
  changedById: string;
  createdAt: Date | string;
}

export interface TimelineEntry extends TimelineHistoryLike {
  /**
   * `true` para a entrada de criação (`fromStatus: null`). A UI precisa
   * tratar esse item como "abertura", não como uma transição vinda de um
   * status vazio — `fromStatus: null` nunca é um `OccurrenceStatus` válido,
   * só o marcador de que a ocorrência acabou de nascer.
   */
  isOpening: boolean;
}

function toTime(value: Date | string): number {
  return (typeof value === 'string' ? new Date(value) : value).getTime();
}

/**
 * Deriva a timeline em ordem cronológica crescente a partir do histórico bruto
 * da API — `GET /occurrences/[id]` já devolve `history` ordenado, mas esta
 * função não confia nisso: ordena de novo, sem mutar o array recebido, para
 * não acoplar a UI a uma garantia de ordenação de outra camada.
 */
export function buildTimeline(history: readonly TimelineHistoryLike[]): TimelineEntry[] {
  return [...history]
    .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))
    .map((entry) => ({ ...entry, isOpening: entry.fromStatus === null }));
}
