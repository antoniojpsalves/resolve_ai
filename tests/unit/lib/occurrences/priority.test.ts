import { describe, expect, it } from 'vitest';

import { ALL_PRIORITIES, priorityBadgeClassName, priorityLabel } from '@/lib/occurrences/priority';

describe('priorityLabel', () => {
  it('devolve um rótulo em português não vazio para todas as prioridades', () => {
    for (const priority of ALL_PRIORITIES) {
      expect(priorityLabel(priority)).toMatch(/\S/);
    }
  });

  it('mapeia cada prioridade para o rótulo esperado', () => {
    expect(priorityLabel('BAIXA')).toBe('Baixa');
    expect(priorityLabel('MEDIA')).toBe('Média');
    expect(priorityLabel('ALTA')).toBe('Alta');
    expect(priorityLabel('URGENTE')).toBe('Urgente');
  });
});

describe('priorityBadgeClassName', () => {
  it('define classes distintas para as quatro prioridades', () => {
    const classNames = ALL_PRIORITIES.map((priority) => priorityBadgeClassName(priority));
    expect(new Set(classNames).size).toBe(ALL_PRIORITIES.length);
  });

  it('cobre um par claro/escuro em cada classe', () => {
    for (const priority of ALL_PRIORITIES) {
      expect(priorityBadgeClassName(priority)).toContain('dark:');
    }
  });
});
