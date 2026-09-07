import { describe, expect, it } from 'vitest';

import { ForbiddenError, NotFoundError } from '@/core/errors';
import { updateOccurrencePriority } from '@/modules/occurrence/application/update-occurrence-priority';
import type { OccurrenceRecord } from '@/modules/occurrence/application/ports/occurrence-repository';
import type { Actor } from '@/modules/occurrence/domain/occurrence';

import { createInMemoryOccurrenceRepository } from '../../helpers/occurrence-repository';

const ana: Actor = { id: 'user-ana', role: 'SOLICITANTE' };
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

describe('updateOccurrencePriority', () => {
  it('lança NotFoundError quando a ocorrência não existe', async () => {
    const { repository } = createInMemoryOccurrenceRepository([]);

    await expect(
      updateOccurrencePriority('occ-inexistente', gestor, 'ALTA', { occurrences: repository }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lança ForbiddenError quando o ator não é GESTOR', async () => {
    const record = buildRecord();
    const { repository } = createInMemoryOccurrenceRepository([record]);

    const error = await updateOccurrencePriority(record.id, ana, 'ALTA', {
      occurrences: repository,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({ status: 403 });
  });

  it('gestor muda a prioridade com sucesso, sem tocar em status/assignedToId', async () => {
    const record = buildRecord({ status: 'EM_ANALISE', assignedToId: 'user-outro-gestor' });
    const { repository } = createInMemoryOccurrenceRepository([record]);

    const updated = await updateOccurrencePriority(record.id, gestor, 'URGENTE', {
      occurrences: repository,
    });

    expect(updated.priority).toBe('URGENTE');
    expect(updated.status).toBe('EM_ANALISE');
    expect(updated.assignedToId).toBe('user-outro-gestor');
  });
});
