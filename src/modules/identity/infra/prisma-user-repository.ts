import { Prisma, type User as PrismaUser } from '@prisma/client';

import { prisma } from '@/core/db/prisma';
import { ConflictError } from '@/core/errors';
import type {
  CreateUserData,
  UserRepository,
} from '@/modules/identity/application/ports/user-repository';
import type { Role } from '@/modules/identity/domain/role';
import type { User } from '@/modules/identity/domain/user';

/** Código do Prisma para violação de constraint única. */
const UNIQUE_VIOLATION = 'P2002';

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

  async findById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } });

    return row ? toDomain(row) : null;
  },

  async create(data: CreateUserData): Promise<User> {
    try {
      const row = await prisma.user.create({ data });

      return toDomain(row);
    } catch (error) {
      // O `findByEmail` do use-case e este `create` não são atômicos: dois
      // cadastros simultâneos do mesmo e-mail passam os dois pela checagem e o
      // segundo esbarra na unique do Postgres. Sem esta tradução, o P2002 subiria
      // como erro desconhecido e viraria 500 em vez do 409 correto.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictError('E-mail já cadastrado', {
          detail: 'Já existe uma conta usando este e-mail.',
        });
      }

      throw error;
    }
  },
};
