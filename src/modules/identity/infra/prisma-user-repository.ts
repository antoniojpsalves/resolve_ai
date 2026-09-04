import type { User as PrismaUser } from '@prisma/client';

import { prisma } from '@/core/db/prisma';
import type {
  CreateUserData,
  UserRepository,
} from '@/modules/identity/application/ports/user-repository';
import type { Role } from '@/modules/identity/domain/role';
import type { User } from '@/modules/identity/domain/user';

/** Traduz a linha do Prisma para a entidade de domínio. */
function toDomain(row: PrismaUser): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role as Role,
    createdAt: row.createdAt,
  };
}

/** Implementação Prisma da port `UserRepository`. */
export const prismaUserRepository: UserRepository = {
  async findByEmail(email: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { email } });

    return row ? toDomain(row) : null;
  },

  async create(data: CreateUserData): Promise<User> {
    const row = await prisma.user.create({ data });

    return toDomain(row);
  },
};
