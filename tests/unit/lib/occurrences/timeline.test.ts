import { describe, expect, it } from 'vitest';

import { buildTimeline, type TimelineHistoryLike } from '@/lib/occurrences/timeline';

function entry(overrides: Partial<TimelineHistoryLike> = {}): TimelineHistoryLike {
  return {
    id: 'h1',
    fromStatus: 'ABERTA',
    toStatus: 'EM_ANALISE',
    note: null,
    changedById: 'user-1',
    changedByName: 'Usuário de Teste',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('buildTimeline', () => {
  it('marca a entrada com fromStatus nulo como abertura, não como transição', () => {
    const [opening] = buildTimeline([
      entry({ id: 'h0', fromStatus: null, toStatus: 'ABERTA', createdAt: new Date('2026-01-01') }),
    ]);

    expect(opening.isOpening).toBe(true);
  });

  it('marca as demais entradas como transição (não abertura)', () => {
    const [transition] = buildTimeline([entry({ fromStatus: 'ABERTA', toStatus: 'EM_ANALISE' })]);

    expect(transition.isOpening).toBe(false);
  });

  it('ordena em ordem cronológica crescente, mesmo que a entrada chegue fora de ordem', () => {
    const timeline = buildTimeline([
      entry({ id: 'h2', createdAt: new Date('2026-01-03'), toStatus: 'EM_ATENDIMENTO' }),
      entry({ id: 'h0', fromStatus: null, toStatus: 'ABERTA', createdAt: new Date('2026-01-01') }),
      entry({ id: 'h1', createdAt: new Date('2026-01-02'), toStatus: 'EM_ANALISE' }),
    ]);

    expect(timeline.map((item) => item.id)).toEqual(['h0', 'h1', 'h2']);
  });

  it('aceita createdAt como string ISO', () => {
    const timeline = buildTimeline([
      entry({ id: 'h2', createdAt: '2026-01-03T00:00:00.000Z' }),
      entry({ id: 'h1', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);

    expect(timeline.map((item) => item.id)).toEqual(['h1', 'h2']);
  });

  it('não muta o array recebido', () => {
    const history = [
      entry({ id: 'h2', createdAt: new Date('2026-01-03') }),
      entry({ id: 'h1', createdAt: new Date('2026-01-01') }),
    ];
    const original = [...history];

    buildTimeline(history);

    expect(history).toEqual(original);
  });

  it('lista vazia devolve timeline vazia', () => {
    expect(buildTimeline([])).toEqual([]);
  });
});
