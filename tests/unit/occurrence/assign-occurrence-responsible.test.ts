import { describe, expect, it } from 'vitest';

import { ForbiddenError, NotFoundError } from '@/core/errors';
import { assignOccurrenceResponsible } from '@/modules/occurrence/application/assign-occurrence-responsible';
import type { OccurrenceRecord } from '@/modules/occurrence/application/ports/occurrence-repository';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import type { User } from '@/modules/identity/domain/user';

import { createInMemoryOccurrenceRepository } from '../../helpers/occurrence-repository';
import { createInMemoryUserRepository } from '../../helpers/user-repository';

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

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-outro-gestor',
    name: 'Outro Gestor',
    email: 'outro-gestor@example.com',
    passwordHash: 'hash-fake',
    role: 'GESTOR',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('assignOccurrenceResponsible', () => {
  it('lança NotFoundError quando a ocorrência não existe', async () => {
    const { repository: occurrences } = createInMemoryOccurrenceRepository([]);
    const { repository: users } = createInMemoryUserRepository([]);

    await expect(
      assignOccurrenceResponsible('occ-inexistente', gestor, null, { occurrences, users }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lança ForbiddenError quando o ator não é GESTOR', async () => {
    const record = buildRecord();
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);
    const { repository: users } = createInMemoryUserRepository([]);

    const error = await assignOccurrenceResponsible(record.id, ana, null, {
      occurrences,
      users,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({ status: 403 });
  });

  it('lança NotFoundError quando o userId não existe', async () => {
    const record = buildRecord();
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);
    const { repository: users } = createInMemoryUserRepository([]);

    const error = await assignOccurrenceResponsible(record.id, gestor, 'user-inexistente', {
      occurrences,
      users,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404, title: 'Responsável inválido' });
  });

  it('lança NotFoundError quando o userId existe mas não é GESTOR (é SOLICITANTE)', async () => {
    const record = buildRecord();
    const solicitanteComoResponsavel = buildUser({
      id: 'user-solicitante-qualquer',
      role: 'SOLICITANTE',
    });
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);
    const { repository: users } = createInMemoryUserRepository([solicitanteComoResponsavel]);

    const error = await assignOccurrenceResponsible(
      record.id,
      gestor,
      solicitanteComoResponsavel.id,
      { occurrences, users },
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404, title: 'Responsável inválido' });
  });

  it('gestor atribui um GESTOR válido como responsável', async () => {
    const record = buildRecord();
    const outroGestor = buildUser();
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);
    const { repository: users } = createInMemoryUserRepository([outroGestor]);

    const updated = await assignOccurrenceResponsible(record.id, gestor, outroGestor.id, {
      occurrences,
      users,
    });

    expect(updated.assignedToId).toBe(outroGestor.id);
  });

  it('gestor desatribui passando userId null, sem checagem nenhuma', async () => {
    const record = buildRecord({ assignedToId: 'user-outro-gestor' });
    const { repository: occurrences } = createInMemoryOccurrenceRepository([record]);
    const { repository: users } = createInMemoryUserRepository([]);

    const updated = await assignOccurrenceResponsible(record.id, gestor, null, {
      occurrences,
      users,
    });

    expect(updated.assignedToId).toBeNull();
  });
});
