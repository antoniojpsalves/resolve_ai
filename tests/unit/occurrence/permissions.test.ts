import { describe, expect, it } from 'vitest';

import {
  canAssignResponsible,
  canChangePriority,
  canCommentOccurrence,
  canRateOccurrence,
  canRegisterResolution,
  canViewOccurrence,
} from '@/modules/occurrence/domain/permissions';
import type { Actor, Occurrence } from '@/modules/occurrence/domain/occurrence';

const AUTOR_ID = 'user-autor';

function buildOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: 'occ-1',
    code: 'OC-2026-000001',
    status: 'ABERTA',
    priority: 'MEDIA',
    createdById: AUTOR_ID,
    ...overrides,
  };
}

const gestor: Actor = { id: 'user-gestor', role: 'GESTOR' };
const autor: Actor = { id: AUTOR_ID, role: 'SOLICITANTE' };
const outroSolicitante: Actor = { id: 'user-outro', role: 'SOLICITANTE' };

describe('canViewOccurrence', () => {
  it('gestor vê qualquer ocorrência', () => {
    expect(canViewOccurrence(gestor, buildOccurrence())).toBe(true);
  });

  it('o autor vê a própria ocorrência', () => {
    expect(canViewOccurrence(autor, buildOccurrence())).toBe(true);
  });

  it('solicitante que não é o autor não vê a ocorrência', () => {
    expect(canViewOccurrence(outroSolicitante, buildOccurrence())).toBe(false);
  });
});

describe('canCommentOccurrence', () => {
  it('gestor comenta em qualquer ocorrência', () => {
    expect(canCommentOccurrence(gestor, buildOccurrence())).toBe(true);
  });

  it('o autor comenta na própria ocorrência', () => {
    expect(canCommentOccurrence(autor, buildOccurrence())).toBe(true);
  });

  it('solicitante que não é o autor não comenta', () => {
    expect(canCommentOccurrence(outroSolicitante, buildOccurrence())).toBe(false);
  });
});

describe('canChangePriority', () => {
  it('gestor pode mudar prioridade', () => {
    expect(canChangePriority(gestor, buildOccurrence())).toBe(true);
  });

  it('o próprio autor não pode mudar prioridade', () => {
    expect(canChangePriority(autor, buildOccurrence())).toBe(false);
  });
});

describe('canAssignResponsible', () => {
  it('gestor pode atribuir responsável', () => {
    expect(canAssignResponsible(gestor, buildOccurrence())).toBe(true);
  });

  it('solicitante não pode atribuir responsável', () => {
    expect(canAssignResponsible(outroSolicitante, buildOccurrence())).toBe(false);
  });
});

describe('canRegisterResolution', () => {
  it('gestor pode registrar solução', () => {
    expect(canRegisterResolution(gestor, buildOccurrence())).toBe(true);
  });

  it('solicitante não pode registrar solução, mesmo sendo o autor', () => {
    expect(canRegisterResolution(autor, buildOccurrence())).toBe(false);
  });
});

describe('canRateOccurrence', () => {
  it('o autor pode avaliar quando a ocorrência está RESOLVIDA', () => {
    const resultado = canRateOccurrence(autor, buildOccurrence({ status: 'RESOLVIDA' }));
    expect(resultado).toBe(true);
  });

  it('o autor não pode avaliar se a ocorrência ainda não está RESOLVIDA', () => {
    const resultado = canRateOccurrence(autor, buildOccurrence({ status: 'EM_ATENDIMENTO' }));
    expect(resultado).toBe(false);
  });

  it('quem não é o autor não pode avaliar, mesmo RESOLVIDA', () => {
    const resultado = canRateOccurrence(
      outroSolicitante,
      buildOccurrence({ status: 'RESOLVIDA' }),
    );
    expect(resultado).toBe(false);
  });

  it('gestor não pode avaliar (só o autor avalia)', () => {
    const resultado = canRateOccurrence(gestor, buildOccurrence({ status: 'RESOLVIDA' }));
    expect(resultado).toBe(false);
  });
});
