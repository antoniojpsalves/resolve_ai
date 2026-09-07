import { describe, expect, it } from 'vitest';

import { listManagers } from '@/modules/identity/application/list-managers';
import type { User } from '@/modules/identity/domain/user';

import { createInMemoryUserRepository } from '../../helpers/user-repository';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Ana Souza',
    email: 'ana.souza@resolveai.com',
    passwordHash: 'hash-secreto',
    role: 'GESTOR',
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
    ...overrides,
  };
}

describe('listManagers', () => {
  it('devolve só usuários com role GESTOR, nunca SOLICITANTE', async () => {
    const { repository } = createInMemoryUserRepository([
      buildUser({ id: 'user-1', email: 'gestor@resolveai.com', role: 'GESTOR' }),
      buildUser({ id: 'user-2', email: 'solicitante@resolveai.com', role: 'SOLICITANTE' }),
    ]);

    const result = await listManagers({ users: repository });

    expect(result).toEqual([
      { id: 'user-1', name: 'Ana Souza', email: 'gestor@resolveai.com', role: 'GESTOR' },
    ]);
  });

  it('ordena por nome (localeCompare)', async () => {
    const { repository } = createInMemoryUserRepository([
      buildUser({ id: 'user-1', name: 'Zeca', email: 'zeca@resolveai.com', role: 'GESTOR' }),
      buildUser({ id: 'user-2', name: 'Ana', email: 'ana@resolveai.com', role: 'GESTOR' }),
    ]);

    const result = await listManagers({ users: repository });

    expect(result.map((user) => user.name)).toEqual(['Ana', 'Zeca']);
  });

  it('nunca inclui passwordHash no retorno', async () => {
    const { repository } = createInMemoryUserRepository([
      buildUser({ id: 'user-1', role: 'GESTOR', passwordHash: 'hash-super-secreto' }),
    ]);

    const result = await listManagers({ users: repository });

    for (const manager of result) {
      expect(manager).not.toHaveProperty('passwordHash');
    }
    expect(JSON.stringify(result)).not.toContain('hash-super-secreto');
  });

  it('devolve [] quando não há nenhum gestor', async () => {
    const { repository } = createInMemoryUserRepository([
      buildUser({ id: 'user-1', role: 'SOLICITANTE' }),
    ]);

    const result = await listManagers({ users: repository });

    expect(result).toEqual([]);
  });
});
