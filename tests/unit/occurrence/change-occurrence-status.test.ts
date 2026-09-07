import { describe, expect, it } from 'vitest';

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/core/errors';
import {
  changeOccurrenceStatus,
  changeOccurrenceStatusSchema,
} from '@/modules/occurrence/application/change-occurrence-status';
import type { OccurrenceRecord } from '@/modules/occurrence/application/ports/occurrence-repository';
import type { Actor } from '@/modules/occurrence/domain/occurrence';

import { createInMemoryOccurrenceRepository } from '../../helpers/occurrence-repository';

const ana: Actor = { id: 'user-ana', role: 'SOLICITANTE' };
const bruno: Actor = { id: 'user-bruno', role: 'SOLICITANTE' };
const gestor: Actor = { id: 'user-gestor', role: 'GESTOR' };

function buildRecord(overrides: Partial<OccurrenceRecord> = {}): OccurrenceRecord {
  return {
    id: 'occ-ana-1',
    code: 'OC-2026-000001',
    title: 'Vazamento na garagem',
    description: 'Água acumulada perto da vaga 12',
    status: 'ABERTA',
    priority: 'MEDIA',
    categoryId: 'cat-hidraulica',
    categoryName: 'Hidráulica',
    locationLabel: 'Bloco B, garagem -1',
    latitude: null,
    longitude: null,
    imageUrl: null,
    imageKey: null,
    createdById: ana.id,
    assignedToId: null,
    assignedToName: null,
    resolutionNote: null,
    resolvedAt: null,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('changeOccurrenceStatusSchema', () => {
  it('rejeita toStatus fora do enum', () => {
    expect(changeOccurrenceStatusSchema.safeParse({ toStatus: 'BANANA' }).success).toBe(false);
  });

  it('rejeita campo desconhecido (.strict())', () => {
    expect(
      changeOccurrenceStatusSchema.safeParse({ toStatus: 'CANCELADA', extra: 'nope' }).success,
    ).toBe(false);
  });

  it('note/resolutionNote vazios ou só espaço não passam no min(1)', () => {
    expect(
      changeOccurrenceStatusSchema.safeParse({ toStatus: 'CANCELADA', note: '' }).success,
    ).toBe(false);
    expect(
      changeOccurrenceStatusSchema.safeParse({ toStatus: 'CANCELADA', note: '   ' }).success,
    ).toBe(false);
  });

  it('aceita só toStatus, note e resolutionNote opcionais', () => {
    expect(changeOccurrenceStatusSchema.safeParse({ toStatus: 'EM_ANALISE' }).success).toBe(true);
  });
});

describe('changeOccurrenceStatus', () => {
  describe('404, não 403 — ocorrência inexistente ou que o ator não pode ver', () => {
    it('lança NotFoundError quando a ocorrência não existe', async () => {
      const { repository } = createInMemoryOccurrenceRepository([]);

      await expect(
        changeOccurrenceStatus(
          'occ-inexistente',
          ana,
          changeOccurrenceStatusSchema.parse({ toStatus: 'CANCELADA', note: 'Desisti' }),
          { occurrences: repository },
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFoundError (não ForbiddenError) quando a ocorrência é de outra pessoa', async () => {
      const record = buildRecord({ createdById: ana.id });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const error = await changeOccurrenceStatus(
        record.id,
        bruno,
        changeOccurrenceStatusSchema.parse({ toStatus: 'CANCELADA', note: 'Não é meu' }),
        { occurrences: repository },
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    });
  });

  describe('tabela de erro de canTransition → AppError', () => {
    it('STATUS_TERMINAL → ConflictError (409) quando o status atual já é terminal', async () => {
      const record = buildRecord({ status: 'CANCELADA' });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const error = await changeOccurrenceStatus(
        record.id,
        gestor,
        changeOccurrenceStatusSchema.parse({ toStatus: 'EM_ANALISE' }),
        { occurrences: repository },
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ status: 409 });
    });

    it('TRANSICAO_INVALIDA → ConflictError (409) para um par (from, to) que não existe', async () => {
      const record = buildRecord({ status: 'ABERTA' });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const error = await changeOccurrenceStatus(
        record.id,
        gestor,
        changeOccurrenceStatusSchema.parse({ toStatus: 'RESOLVIDA', resolutionNote: 'Feito' }),
        { occurrences: repository },
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ status: 409 });
    });

    it('PERMISSAO_NEGADA → ForbiddenError (403) quando solicitante tenta uma transição além de cancelar a própria ABERTA', async () => {
      const record = buildRecord({ status: 'ABERTA', createdById: ana.id });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const error = await changeOccurrenceStatus(
        record.id,
        ana,
        changeOccurrenceStatusSchema.parse({ toStatus: 'EM_ANALISE' }),
        { occurrences: repository },
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error).toMatchObject({ status: 403 });
    });

    it('OBSERVACAO_OBRIGATORIA → ValidationError (422) quando falta note para cancelar', async () => {
      const record = buildRecord({ status: 'ABERTA' });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const error = await changeOccurrenceStatus(
        record.id,
        gestor,
        changeOccurrenceStatusSchema.parse({ toStatus: 'CANCELADA' }),
        { occurrences: repository },
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({ status: 422 });
    });

    it('SOLUCAO_OBRIGATORIA → ValidationError (422) quando falta resolutionNote para resolver', async () => {
      const record = buildRecord({ status: 'EM_ATENDIMENTO' });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const error = await changeOccurrenceStatus(
        record.id,
        gestor,
        changeOccurrenceStatusSchema.parse({ toStatus: 'RESOLVIDA' }),
        { occurrences: repository },
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({ status: 422 });
    });
  });

  describe('happy path', () => {
    it('gestor move ABERTA → EM_ANALISE', async () => {
      const record = buildRecord({ status: 'ABERTA' });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const updated = await changeOccurrenceStatus(
        record.id,
        gestor,
        changeOccurrenceStatusSchema.parse({ toStatus: 'EM_ANALISE', note: 'Começando análise' }),
        { occurrences: repository },
      );

      expect(updated.status).toBe('EM_ANALISE');

      const detail = await repository.findById(record.id);
      expect(detail?.history.at(-1)).toMatchObject({
        fromStatus: 'ABERTA',
        toStatus: 'EM_ANALISE',
        note: 'Começando análise',
        changedById: gestor.id,
      });
    });

    it('gestor resolve com resolutionNote, gravando resolutionNote e resolvedAt', async () => {
      const record = buildRecord({ status: 'EM_ATENDIMENTO' });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const updated = await changeOccurrenceStatus(
        record.id,
        gestor,
        changeOccurrenceStatusSchema.parse({
          toStatus: 'RESOLVIDA',
          resolutionNote: 'Vazamento reparado',
        }),
        { occurrences: repository },
      );

      expect(updated.status).toBe('RESOLVIDA');
      expect(updated.resolutionNote).toBe('Vazamento reparado');
      expect(updated.resolvedAt).toBeInstanceOf(Date);
    });

    it('o autor cancela a própria ocorrência ABERTA', async () => {
      const record = buildRecord({ status: 'ABERTA', createdById: ana.id });
      const { repository } = createInMemoryOccurrenceRepository([record]);

      const updated = await changeOccurrenceStatus(
        record.id,
        ana,
        changeOccurrenceStatusSchema.parse({
          toStatus: 'CANCELADA',
          note: 'Resolvi por conta própria',
        }),
        { occurrences: repository },
      );

      expect(updated.status).toBe('CANCELADA');

      const detail = await repository.findById(record.id);
      expect(detail?.history.at(-1)).toMatchObject({
        fromStatus: 'ABERTA',
        toStatus: 'CANCELADA',
        note: 'Resolvi por conta própria',
        changedById: ana.id,
      });
    });
  });
});
