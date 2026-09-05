import { describe, expect, it, vi } from 'vitest';

import {
  authenticateUser,
  authenticateUserSchema,
} from '@/modules/identity/application/authenticate-user';
import type { User } from '@/modules/identity/domain/user';
import { hashPassword, verifyPassword } from '@/modules/identity/infra/password';

import { createInMemoryUserRepository } from '../../helpers/user-repository';

const SENHA = 'Senha@123';

/** Monta o seed com um hash real de `SENHA` — o helper compartilhado recebe
 * usuários já prontos (`passwordHash` incluso) em vez de hashear por trás. */
async function buildAna(): Promise<User> {
  return {
    id: 'user-ana',
    name: 'Ana Paula Ribeiro',
    email: 'ana@resolveai.com',
    role: 'SOLICITANTE',
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
    passwordHash: await hashPassword(SENHA),
  };
}

describe('authenticateUserSchema', () => {
  it('normaliza o e-mail para lowercase e sem espaços', () => {
    const parsed = authenticateUserSchema.parse({
      email: '  ANA@ResolveAI.com ',
      password: SENHA,
    });

    expect(parsed.email).toBe('ana@resolveai.com');
  });

  it.each([
    ['e-mail inválido', { email: 'nao-eh-email', password: SENHA }],
    ['senha vazia', { email: 'ana@resolveai.com', password: '' }],
    ['campos ausentes', {}],
  ])('rejeita %s', (_label, input) => {
    expect(authenticateUserSchema.safeParse(input).success).toBe(false);
  });
});

describe('authenticateUser', () => {
  it('devolve a projeção pública quando as credenciais conferem', async () => {
    const { repository } = createInMemoryUserRepository([await buildAna()]);

    const result = await authenticateUser(
      { email: 'ana@resolveai.com', password: SENHA },
      { users: repository, verifyPassword },
    );

    expect(result).toEqual({
      id: 'user-ana',
      name: 'Ana Paula Ribeiro',
      email: 'ana@resolveai.com',
      role: 'SOLICITANTE',
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('aceita o e-mail em caixa diferente', async () => {
    const { repository } = createInMemoryUserRepository([await buildAna()]);

    const result = await authenticateUser(
      { email: 'ANA@RESOLVEAI.COM', password: SENHA },
      { users: repository, verifyPassword },
    );

    expect(result?.id).toBe('user-ana');
  });

  it('devolve null quando a senha está errada', async () => {
    const { repository } = createInMemoryUserRepository([await buildAna()]);

    const result = await authenticateUser(
      { email: 'ana@resolveai.com', password: 'SenhaErrada@1' },
      { users: repository, verifyPassword },
    );

    expect(result).toBeNull();
  });

  it('devolve null quando o e-mail não existe', async () => {
    const { repository } = createInMemoryUserRepository([await buildAna()]);

    const result = await authenticateUser(
      { email: 'nao.existe@resolveai.com', password: SENHA },
      { users: repository, verifyPassword },
    );

    expect(result).toBeNull();
  });

  describe('defesa contra oráculo de temporização', () => {
    it('verifica a senha contra um hash dummy quando o usuário não existe', async () => {
      const { repository } = createInMemoryUserRepository([await buildAna()]);
      const spy = vi.fn(verifyPassword);

      await authenticateUser(
        { email: 'nao.existe@resolveai.com', password: 'SenhaErrada@1' },
        { users: repository, verifyPassword: spy },
      );

      // O ponto do fix: o caminho "usuário inexistente" também gasta um bcrypt.
      expect(spy).toHaveBeenCalledTimes(1);

      const [plain, hash] = spy.mock.calls[0];

      expect(plain).toBe('SenhaErrada@1');
      // Hash bcrypt válido e de cost 10 — o mesmo SALT_ROUNDS de infra/password.ts.
      expect(hash).toMatch(/^\$2[aby]\$10\$/);
    });

    it('usa o mesmo número de verificações nos dois caminhos de falha', async () => {
      const { repository } = createInMemoryUserRepository([await buildAna()]);

      const spyInexistente = vi.fn(verifyPassword);
      await authenticateUser(
        { email: 'nao.existe@resolveai.com', password: 'SenhaErrada@1' },
        { users: repository, verifyPassword: spyInexistente },
      );

      const spyExistente = vi.fn(verifyPassword);
      await authenticateUser(
        { email: 'ana@resolveai.com', password: 'SenhaErrada@1' },
        { users: repository, verifyPassword: spyExistente },
      );

      expect(spyInexistente).toHaveBeenCalledTimes(spyExistente.mock.calls.length);
    });

    it('o hash dummy nunca autentica ninguém', async () => {
      const { repository } = createInMemoryUserRepository();
      const spy = vi.fn(verifyPassword);

      const result = await authenticateUser(
        { email: 'qualquer@resolveai.com', password: 'qualquer-senha' },
        { users: repository, verifyPassword: spy },
      );

      expect(result).toBeNull();
      await expect(spy.mock.results[0].value).resolves.toBe(false);
    });

    it('os dois caminhos de falha gastam tempos comparáveis (bcrypt real)', async () => {
      const { repository } = createInMemoryUserRepository([await buildAna()]);

      const medir = async (email: string) => {
        const inicio = performance.now();
        await authenticateUser(
          { email, password: 'SenhaErrada@1' },
          { users: repository, verifyPassword },
        );
        return performance.now() - inicio;
      };

      // aquecimento
      await medir('ana@resolveai.com');
      await medir('nao.existe@resolveai.com');

      const existente = await medir('ana@resolveai.com');
      const inexistente = await medir('nao.existe@resolveai.com');

      // Antes do fix a razão era ~20x. Uma margem de 3x é folgada o suficiente
      // para não ficar instável em CI e apertada o suficiente para pegar uma
      // regressão que remova o bcrypt do caminho do usuário inexistente.
      const razao = Math.max(existente, inexistente) / Math.min(existente, inexistente);

      expect(razao).toBeLessThan(3);
    });
  });
});
