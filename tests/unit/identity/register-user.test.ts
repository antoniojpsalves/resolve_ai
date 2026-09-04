import { describe, expect, it } from 'vitest';

import { ConflictError } from '@/core/errors';
import type {
  CreateUserData,
  UserRepository,
} from '@/modules/identity/application/ports/user-repository';
import {
  registerUser,
  registerUserSchema,
  type RegisterUserInput,
} from '@/modules/identity/application/register-user';
import type { User } from '@/modules/identity/domain/user';
import { hashPassword, verifyPassword } from '@/modules/identity/infra/password';

/** Repositório fake em memória — o use-case não conhece Prisma. */
function createInMemoryUserRepository(seed: User[] = []) {
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

const deps = (repository: UserRepository) => ({ users: repository, hashPassword });

const validInput: RegisterUserInput = {
  name: 'Ana Souza',
  email: 'ana.souza@resolveai.com',
  password: 'Senha@123',
};

describe('registerUserSchema', () => {
  it('normaliza o e-mail para lowercase e sem espaços', () => {
    const parsed = registerUserSchema.parse({
      name: 'Ana Souza',
      email: '  ANA.Souza@ResolveAI.com  ',
      password: 'Senha@123',
    });

    expect(parsed.email).toBe('ana.souza@resolveai.com');
  });

  it('descarta o campo role enviado pelo cliente', () => {
    const parsed = registerUserSchema.parse({ ...validInput, role: 'GESTOR' });

    expect(parsed).not.toHaveProperty('role');
  });

  it.each([
    ['nome curto', { ...validInput, name: 'An' }],
    ['e-mail inválido', { ...validInput, email: 'nao-eh-email' }],
    ['senha curta', { ...validInput, password: 'Ab1' }],
    ['senha sem número', { ...validInput, password: 'senhasegura' }],
    ['senha sem letra', { ...validInput, password: '12345678' }],
  ])('rejeita %s', (_label, input) => {
    expect(registerUserSchema.safeParse(input).success).toBe(false);
  });

  it('aceita uma senha com ao menos uma letra e um número', () => {
    expect(registerUserSchema.safeParse({ ...validInput, password: 'senha123' }).success).toBe(
      true,
    );
  });
});

describe('registerUser', () => {
  it('cria o usuário e devolve a projeção pública', async () => {
    const { repository } = createInMemoryUserRepository();

    const user = await registerUser(validInput, deps(repository));

    expect(user).toEqual({
      id: 'user-1',
      name: 'Ana Souza',
      email: 'ana.souza@resolveai.com',
      role: 'SOLICITANTE',
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('força o papel SOLICITANTE mesmo se o chamador tentar outro', async () => {
    const { repository, rows } = createInMemoryUserRepository();

    // O tipo já impede `role` na entrada; o cast simula um cliente malicioso
    // que tenha atravessado a validação.
    await registerUser({ ...validInput, role: 'GESTOR' } as RegisterUserInput, deps(repository));

    expect(rows.get('ana.souza@resolveai.com')?.role).toBe('SOLICITANTE');
  });

  it('nunca armazena a senha em texto puro', async () => {
    const { repository, rows } = createInMemoryUserRepository();

    await registerUser(validInput, deps(repository));

    const stored = rows.get('ana.souza@resolveai.com');

    expect(stored).toBeDefined();
    expect(stored!.passwordHash).not.toBe(validInput.password);
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword(validInput.password, stored!.passwordHash)).resolves.toBe(true);
  });

  it('lança ConflictError quando o e-mail já existe', async () => {
    const { repository } = createInMemoryUserRepository([
      {
        id: 'user-existente',
        name: 'Ana Souza',
        email: 'ana.souza@resolveai.com',
        passwordHash: 'hash-qualquer',
        role: 'SOLICITANTE',
        createdAt: new Date('2026-09-01T12:00:00.000Z'),
      },
    ]);

    await expect(registerUser(validInput, deps(repository))).rejects.toBeInstanceOf(ConflictError);
    await expect(registerUser(validInput, deps(repository))).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
  });

  it('detecta a duplicidade mesmo com e-mail em caixa diferente', async () => {
    const { repository } = createInMemoryUserRepository();

    await registerUser(validInput, deps(repository));

    await expect(
      registerUser({ ...validInput, email: 'ANA.SOUZA@RESOLVEAI.COM' }, deps(repository)),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('não consulta o hasher antes de confirmar que o e-mail está livre', async () => {
    const { repository } = createInMemoryUserRepository([
      {
        id: 'user-existente',
        name: 'Ana Souza',
        email: 'ana.souza@resolveai.com',
        passwordHash: 'hash-qualquer',
        role: 'SOLICITANTE',
        createdAt: new Date('2026-09-01T12:00:00.000Z'),
      },
    ]);

    let hashCalls = 0;
    const countingHasher = async (plain: string) => {
      hashCalls += 1;
      return hashPassword(plain);
    };

    await expect(
      registerUser(validInput, { users: repository, hashPassword: countingHasher }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(hashCalls).toBe(0);
  });
});
