import { describe, expect, it } from 'vitest';

import { ALL_STATUSES, statusBadgeClassName, statusLabel } from '@/lib/occurrences/status';

describe('statusLabel', () => {
  it('devolve um rótulo em português não vazio para todos os status', () => {
    for (const status of ALL_STATUSES) {
      expect(statusLabel(status)).toMatch(/\S/);
    }
  });

  it('mapeia cada status para o rótulo esperado', () => {
    expect(statusLabel('ABERTA')).toBe('Aberta');
    expect(statusLabel('EM_ANALISE')).toBe('Em análise');
    expect(statusLabel('EM_ATENDIMENTO')).toBe('Em atendimento');
    expect(statusLabel('RESOLVIDA')).toBe('Resolvida');
    expect(statusLabel('CANCELADA')).toBe('Cancelada');
  });
});

describe('statusBadgeClassName', () => {
  it('usa azul para ABERTA, âmbar para EM_ANALISE, índigo para EM_ATENDIMENTO, verde para RESOLVIDA e vermelho para CANCELADA', () => {
    expect(statusBadgeClassName('ABERTA')).toContain('blue');
    expect(statusBadgeClassName('EM_ANALISE')).toContain('amber');
    expect(statusBadgeClassName('EM_ATENDIMENTO')).toContain('indigo');
    expect(statusBadgeClassName('RESOLVIDA')).toContain('green');
    expect(statusBadgeClassName('CANCELADA')).toContain('red');
  });

  it('define classes distintas para os cinco status (sem colisão de cor)', () => {
    const classNames = ALL_STATUSES.map((status) => statusBadgeClassName(status));
    expect(new Set(classNames).size).toBe(ALL_STATUSES.length);
  });

  it('cobre um par claro/escuro em cada classe (contraste nos dois temas)', () => {
    for (const status of ALL_STATUSES) {
      const className = statusBadgeClassName(status);
      expect(className).toContain('dark:');
    }
  });
});
