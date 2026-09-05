import type {
  CreateUserData,
  UserRepository,
} from '@/modules/identity/application/ports/user-repository';
import type { User } from '@/modules/identity/domain/user';

/**
 * Repositório fake em memória, compartilhado pelos testes de `identity`
 * (`register-user.test.ts` e `authenticate-user.test.ts`) — o use-case não
 * conhece Prisma.
 *
 * Recebe `seed` já com `passwordHash` pronto: quem precisa de um hash real
 * (para exercitar `verifyPassword`) gera com `hashPassword` antes de montar o
 * seed, em vez de o helper fazer isso por trás (o que forçaria a função a ser
 * assíncrona só por causa desse caso de uso).
 */
export function createInMemoryUserRepository(seed: User[] = []) {
  const rows = new Map<string, User>(seed.map((user) => [user.email, user]));
  let nextId = seed.length + 1;

  const repository: UserRepository = {
    async findByEmail(email: string) {
      return rows.get(email) ?? null;
    },
    async create(data: CreateUserData) {
      const user: User = {
        id: `user-${nextId++}`,
        createdAt: new Date('2026-09-01T12:00:00.000Z'),
        ...data,
      };

      rows.set(user.email, user);

      return user;
    },
  };

  return { repository, rows };
}
