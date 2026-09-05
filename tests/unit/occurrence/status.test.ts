import { describe, expect, it } from 'vitest';

import { isTerminalStatus, TRANSITIONS } from '@/modules/occurrence/domain/status';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

describe('TRANSITIONS', () => {
  it('ABERTA pode ir para EM_ANALISE e CANCELADA', () => {
    expect(TRANSITIONS.ABERTA).toEqual(['EM_ANALISE', 'CANCELADA']);
  });

  it('EM_ANALISE pode ir para EM_ATENDIMENTO e CANCELADA', () => {
    expect(TRANSITIONS.EM_ANALISE).toEqual(['EM_ATENDIMENTO', 'CANCELADA']);
  });

  it('EM_ATENDIMENTO pode ir para RESOLVIDA e CANCELADA', () => {
    expect(TRANSITIONS.EM_ATENDIMENTO).toEqual(['RESOLVIDA', 'CANCELADA']);
  });

  it('RESOLVIDA não tem destinos (terminal)', () => {
    expect(TRANSITIONS.RESOLVIDA).toEqual([]);
  });

  it('CANCELADA não tem destinos (terminal)', () => {
    expect(TRANSITIONS.CANCELADA).toEqual([]);
  });
});

describe('isTerminalStatus', () => {
  const casos: Array<[OccurrenceStatus, boolean]> = [
    ['ABERTA', false],
    ['EM_ANALISE', false],
    ['EM_ATENDIMENTO', false],
    ['RESOLVIDA', true],
    ['CANCELADA', true],
  ];

  it.each(casos)('isTerminalStatus(%s) === %s', (status, esperado) => {
    expect(isTerminalStatus(status)).toBe(esperado);
  });
});
