import { describe, expect, it } from 'vitest';

import { priorityWeight } from '@/modules/occurrence/domain/priority';
import type { Priority } from '@/modules/occurrence/domain/priority';

describe('priorityWeight', () => {
  it.each<[Priority, number]>([
    ['URGENTE', 3],
    ['ALTA', 2],
    ['MEDIA', 1],
    ['BAIXA', 0],
  ])('priorityWeight(%s) === %s', (priority, esperado) => {
    expect(priorityWeight(priority)).toBe(esperado);
  });

  it('ordena prioridades da mais urgente para a menos urgente', () => {
    const prioridades: Priority[] = ['BAIXA', 'URGENTE', 'MEDIA', 'ALTA'];

    const ordenadas = [...prioridades].sort((a, b) => priorityWeight(b) - priorityWeight(a));

    expect(ordenadas).toEqual(['URGENTE', 'ALTA', 'MEDIA', 'BAIXA']);
  });
});
