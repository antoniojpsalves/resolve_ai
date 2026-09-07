import { describe, expect, it } from 'vitest';

import { canTransition } from '@/modules/occurrence/domain/transitions';
import type { TransitionCheck } from '@/modules/occurrence/domain/transitions';
import type { Actor, Occurrence } from '@/modules/occurrence/domain/occurrence';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

const AUTOR_ID = 'user-autor';

function buildOccurrence(
  status: OccurrenceStatus,
  overrides: Partial<Occurrence> = {},
): Occurrence {
  return {
    id: 'occ-1',
    code: 'OC-2026-000001',
    status,
    priority: 'MEDIA',
    createdById: AUTOR_ID,
    ...overrides,
  };
}

const gestor: Actor = { id: 'user-gestor', role: 'GESTOR' };
const autor: Actor = { id: AUTOR_ID, role: 'SOLICITANTE' };
const outroSolicitante: Actor = { id: 'user-outro', role: 'SOLICITANTE' };

const camposCompletos = { note: 'motivo qualquer', resolutionNote: 'solução qualquer' };

describe('canTransition — matriz completa (5 origens x 5 destinos)', () => {
  const MATRIZ_25_PARES: Array<[OccurrenceStatus, OccurrenceStatus, TransitionCheck]> = [
    // De ABERTA
    ['ABERTA', 'ABERTA', { allowed: false, reason: 'TRANSICAO_INVALIDA' }],
    ['ABERTA', 'EM_ANALISE', { allowed: true }],
    ['ABERTA', 'EM_ATENDIMENTO', { allowed: false, reason: 'TRANSICAO_INVALIDA' }],
    ['ABERTA', 'RESOLVIDA', { allowed: false, reason: 'TRANSICAO_INVALIDA' }],
    ['ABERTA', 'CANCELADA', { allowed: true }],
    // De EM_ANALISE
    ['EM_ANALISE', 'ABERTA', { allowed: false, reason: 'TRANSICAO_INVALIDA' }],
    ['EM_ANALISE', 'EM_ANALISE', { allowed: false, reason: 'TRANSICAO_INVALIDA' }],
    ['EM_ANALISE', 'EM_ATENDIMENTO', { allowed: true }],
    ['EM_ANALISE', 'RESOLVIDA', { allowed: false, reason: 'TRANSICAO_INVALIDA' }],
    ['EM_ANALISE', 'CANCELADA', { allowed: true }],
    // De EM_ATENDIMENTO
    ['EM_ATENDIMENTO', 'ABERTA', { allowed: false, reason: 'TRANSICAO_INVALIDA' }],
    ['EM_ATENDIMENTO', 'EM_ANALISE', { allowed: false, reason: 'TRANSICAO_INVALIDA' }],
    ['EM_ATENDIMENTO', 'EM_ATENDIMENTO', { allowed: false, reason: 'TRANSICAO_INVALIDA' }],
    ['EM_ATENDIMENTO', 'RESOLVIDA', { allowed: true }],
    ['EM_ATENDIMENTO', 'CANCELADA', { allowed: true }],
    // De RESOLVIDA (terminal — nega tudo, mesmo pares "improváveis")
    ['RESOLVIDA', 'ABERTA', { allowed: false, reason: 'STATUS_TERMINAL' }],
    ['RESOLVIDA', 'EM_ANALISE', { allowed: false, reason: 'STATUS_TERMINAL' }],
    ['RESOLVIDA', 'EM_ATENDIMENTO', { allowed: false, reason: 'STATUS_TERMINAL' }],
    ['RESOLVIDA', 'RESOLVIDA', { allowed: false, reason: 'STATUS_TERMINAL' }],
    ['RESOLVIDA', 'CANCELADA', { allowed: false, reason: 'STATUS_TERMINAL' }],
    // De CANCELADA (terminal)
    ['CANCELADA', 'ABERTA', { allowed: false, reason: 'STATUS_TERMINAL' }],
    ['CANCELADA', 'EM_ANALISE', { allowed: false, reason: 'STATUS_TERMINAL' }],
    ['CANCELADA', 'EM_ATENDIMENTO', { allowed: false, reason: 'STATUS_TERMINAL' }],
    ['CANCELADA', 'RESOLVIDA', { allowed: false, reason: 'STATUS_TERMINAL' }],
    ['CANCELADA', 'CANCELADA', { allowed: false, reason: 'STATUS_TERMINAL' }],
  ];

  it.each(MATRIZ_25_PARES)(
    'canTransition(%s -> %s) com gestor e campos completos => %o',
    (from, to, esperado) => {
      const resultado = canTransition(from, to, gestor, buildOccurrence(from), camposCompletos);
      expect(resultado).toEqual(esperado);
    },
  );
});

describe('cada transição válida: ator autorizado x não autorizado', () => {
  it('ABERTA -> EM_ANALISE: gestor autorizado', () => {
    const resultado = canTransition('ABERTA', 'EM_ANALISE', gestor, buildOccurrence('ABERTA'), {});
    expect(resultado).toEqual({ allowed: true });
  });

  it('ABERTA -> EM_ANALISE: solicitante (mesmo autor) não autorizado', () => {
    const resultado = canTransition('ABERTA', 'EM_ANALISE', autor, buildOccurrence('ABERTA'), {});
    expect(resultado).toEqual({ allowed: false, reason: 'PERMISSAO_NEGADA' });
  });

  it('EM_ANALISE -> EM_ATENDIMENTO: gestor autorizado (sem assignedToId — é recomendação, não regra)', () => {
    const resultado = canTransition(
      'EM_ANALISE',
      'EM_ATENDIMENTO',
      gestor,
      buildOccurrence('EM_ANALISE'),
      {},
    );
    expect(resultado).toEqual({ allowed: true });
  });

  it('EM_ANALISE -> EM_ATENDIMENTO: solicitante não autorizado', () => {
    const resultado = canTransition(
      'EM_ANALISE',
      'EM_ATENDIMENTO',
      outroSolicitante,
      buildOccurrence('EM_ANALISE'),
      {},
    );
    expect(resultado).toEqual({ allowed: false, reason: 'PERMISSAO_NEGADA' });
  });

  it('EM_ANALISE -> CANCELADA: gestor autorizado com note', () => {
    const resultado = canTransition(
      'EM_ANALISE',
      'CANCELADA',
      gestor,
      buildOccurrence('EM_ANALISE'),
      { note: 'motivo' },
    );
    expect(resultado).toEqual({ allowed: true });
  });

  it('EM_ANALISE -> CANCELADA: autor da ocorrência NÃO é autorizado (diferente de ABERTA -> CANCELADA)', () => {
    const resultado = canTransition(
      'EM_ANALISE',
      'CANCELADA',
      autor,
      buildOccurrence('EM_ANALISE'),
      { note: 'motivo' },
    );
    expect(resultado).toEqual({ allowed: false, reason: 'PERMISSAO_NEGADA' });
  });

  it('EM_ATENDIMENTO -> RESOLVIDA: gestor autorizado com resolutionNote', () => {
    const resultado = canTransition(
      'EM_ATENDIMENTO',
      'RESOLVIDA',
      gestor,
      buildOccurrence('EM_ATENDIMENTO'),
      { resolutionNote: 'solução' },
    );
    expect(resultado).toEqual({ allowed: true });
  });

  it('EM_ATENDIMENTO -> RESOLVIDA: solicitante não autorizado', () => {
    const resultado = canTransition(
      'EM_ATENDIMENTO',
      'RESOLVIDA',
      outroSolicitante,
      buildOccurrence('EM_ATENDIMENTO'),
      { resolutionNote: 'solução' },
    );
    expect(resultado).toEqual({ allowed: false, reason: 'PERMISSAO_NEGADA' });
  });

  it('EM_ATENDIMENTO -> CANCELADA: gestor autorizado com note', () => {
    const resultado = canTransition(
      'EM_ATENDIMENTO',
      'CANCELADA',
      gestor,
      buildOccurrence('EM_ATENDIMENTO'),
      { note: 'motivo' },
    );
    expect(resultado).toEqual({ allowed: true });
  });

  it('EM_ATENDIMENTO -> CANCELADA: solicitante não autorizado', () => {
    const resultado = canTransition(
      'EM_ATENDIMENTO',
      'CANCELADA',
      outroSolicitante,
      buildOccurrence('EM_ATENDIMENTO'),
      { note: 'motivo' },
    );
    expect(resultado).toEqual({ allowed: false, reason: 'PERMISSAO_NEGADA' });
  });
});

describe('ABERTA -> CANCELADA: caso especial com três atores', () => {
  it('gestor pode cancelar, com note', () => {
    const resultado = canTransition('ABERTA', 'CANCELADA', gestor, buildOccurrence('ABERTA'), {
      note: 'motivo',
    });
    expect(resultado).toEqual({ allowed: true });
  });

  it('o próprio autor pode cancelar, com note', () => {
    const resultado = canTransition('ABERTA', 'CANCELADA', autor, buildOccurrence('ABERTA'), {
      note: 'motivo',
    });
    expect(resultado).toEqual({ allowed: true });
  });

  it('solicitante que NÃO é o autor não pode cancelar', () => {
    const resultado = canTransition(
      'ABERTA',
      'CANCELADA',
      outroSolicitante,
      buildOccurrence('ABERTA'),
      { note: 'motivo' },
    );
    expect(resultado).toEqual({ allowed: false, reason: 'PERMISSAO_NEGADA' });
  });
});

describe('campos obrigatórios: note e resolutionNote', () => {
  it.each([undefined, '', '   '])('ABERTA -> CANCELADA sem note válida (%j) é negado', (note) => {
    const resultado = canTransition('ABERTA', 'CANCELADA', gestor, buildOccurrence('ABERTA'), {
      note,
    });
    expect(resultado).toEqual({ allowed: false, reason: 'OBSERVACAO_OBRIGATORIA' });
  });

  it.each([undefined, '', '   '])(
    'EM_ANALISE -> CANCELADA sem note válida (%j) é negado',
    (note) => {
      const resultado = canTransition(
        'EM_ANALISE',
        'CANCELADA',
        gestor,
        buildOccurrence('EM_ANALISE'),
        { note },
      );
      expect(resultado).toEqual({ allowed: false, reason: 'OBSERVACAO_OBRIGATORIA' });
    },
  );

  it.each([undefined, '', '   '])(
    'EM_ATENDIMENTO -> CANCELADA sem note válida (%j) é negado',
    (note) => {
      const resultado = canTransition(
        'EM_ATENDIMENTO',
        'CANCELADA',
        gestor,
        buildOccurrence('EM_ATENDIMENTO'),
        { note },
      );
      expect(resultado).toEqual({ allowed: false, reason: 'OBSERVACAO_OBRIGATORIA' });
    },
  );

  it.each([undefined, '', '   '])(
    'EM_ATENDIMENTO -> RESOLVIDA sem resolutionNote válida (%j) é negado',
    (resolutionNote) => {
      const resultado = canTransition(
        'EM_ATENDIMENTO',
        'RESOLVIDA',
        gestor,
        buildOccurrence('EM_ATENDIMENTO'),
        { resolutionNote },
      );
      expect(resultado).toEqual({ allowed: false, reason: 'SOLUCAO_OBRIGATORIA' });
    },
  );

  it('note com espaços ao redor de texto real é aceita (trim não remove conteúdo)', () => {
    const resultado = canTransition('ABERTA', 'CANCELADA', gestor, buildOccurrence('ABERTA'), {
      note: '  motivo real  ',
    });
    expect(resultado).toEqual({ allowed: true });
  });
});

describe('precedência das negativas: terminal > transição inválida > permissão > campo obrigatório', () => {
  it('origem terminal vence sobre ator não autorizado e campos faltando', () => {
    const resultado = canTransition(
      'RESOLVIDA',
      'ABERTA',
      outroSolicitante,
      buildOccurrence('RESOLVIDA'),
      {},
    );
    expect(resultado).toEqual({ allowed: false, reason: 'STATUS_TERMINAL' });
  });

  it('transição inválida vence sobre ator não autorizado e campos faltando', () => {
    const resultado = canTransition(
      'ABERTA',
      'RESOLVIDA',
      outroSolicitante,
      buildOccurrence('ABERTA'),
      {},
    );
    expect(resultado).toEqual({ allowed: false, reason: 'TRANSICAO_INVALIDA' });
  });

  it('permissão negada vence sobre campo obrigatório faltando', () => {
    const resultado = canTransition(
      'ABERTA',
      'CANCELADA',
      outroSolicitante,
      buildOccurrence('ABERTA'),
      {},
    );
    expect(resultado).toEqual({ allowed: false, reason: 'PERMISSAO_NEGADA' });
  });
});
