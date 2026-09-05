import { describe, expect, it } from 'vitest';

import { buildOccurrenceCode } from '@/modules/occurrence/domain/protocol';

describe('buildOccurrenceCode', () => {
  it('formata a sequência 1 como OC-2026-000001', () => {
    expect(buildOccurrenceCode(2026, 1)).toBe('OC-2026-000001');
  });

  it('formata a sequência 123 como OC-2026-000123', () => {
    expect(buildOccurrenceCode(2026, 123)).toBe('OC-2026-000123');
  });

  it('formata a sequência 999999 como OC-2026-999999', () => {
    expect(buildOccurrenceCode(2026, 999999)).toBe('OC-2026-999999');
  });
});
