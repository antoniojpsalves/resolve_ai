import type { Role } from '@/modules/identity/domain/role';
import type { User } from '@/modules/identity/domain/user';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

/**
 * Port de persistência de usuários.
 *
 * Os use-cases dependem desta interface, nunca do Prisma. A implementação real
 * vive em `infra/prisma-user-repository.ts`; os testes usam um fake em memória.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}

/**
 * Port de hashing de senha. Mantém o use-case livre de `bcryptjs` — a
 * implementação concreta é `infra/password.ts`, compartilhada com o seed.
 */
export type PasswordHasher = (plain: string) => Promise<string>;

/**
 * Port de verificação de senha. Espelha `verifyPassword` de `infra/password.ts`
 * e mantém o use-case de autenticação livre de `bcryptjs`.
 */
export type PasswordVerifier = (plain: string, hash: string) => Promise<boolean>;
