import { describe, expect, it } from 'vitest';

import { formatDate, formatDateTime } from '@/lib/occurrences/date';

// 2026-03-10T13:05:00Z é 2026-03-10T10:05:00-03:00 em America/Sao_Paulo — o
// fuso é fixado dentro de `date.ts` (independente do TZ do processo rodando
// o teste), então as strings abaixo são determinísticas em qualquer CI.
const SAMPLE = new Date('2026-03-10T13:05:00.000Z');

describe('formatDate', () => {
  it('formata só a data, no padrão dd/mm/aaaa', () => {
    expect(formatDate(SAMPLE)).toBe('10/03/2026');
  });

  it('aceita uma string ISO', () => {
    expect(formatDate('2026-03-10T13:05:00.000Z')).toBe('10/03/2026');
  });
});

describe('formatDateTime', () => {
  it('formata data e hora, no padrão dd/mm/aaaa, hh:mm', () => {
    expect(formatDateTime(SAMPLE)).toBe('10/03/2026, 10:05');
  });
});
