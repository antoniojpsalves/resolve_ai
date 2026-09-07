import { toPublicUser } from '@/modules/identity/domain/user';
import type { PublicUser } from '@/modules/identity/domain/user';

import type { UserRepository } from './ports/user-repository';

export interface ListManagersDeps {
  users: UserRepository;
}

/**
 * Lista todos os usuários com `role: 'GESTOR'`, ordenados por nome — usada
 * pelas telas de detalhe e de backlog para popular o `<Select>` de
 * responsável. Devolve `PublicUser` (via `toPublicUser`), nunca `User`: o
 * resultado atravessa a fronteira Server Component -> Client Component, que
 * o Next serializa no payload enviado ao navegador — devolver `User` aqui
 * vazaria `passwordHash` de todo gestor.
 */
export async function listManagers({ users }: ListManagersDeps): Promise<PublicUser[]> {
  const rows = await users.listByRole('GESTOR');

  return rows.map(toPublicUser).sort((a, b) => a.name.localeCompare(b.name));
}
