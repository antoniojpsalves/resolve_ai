import { z } from 'zod';

import { normalizeEmail, toPublicUser, type PublicUser } from '@/modules/identity/domain/user';

import type { PasswordVerifier, UserRepository } from './ports/user-repository';

/**
 * Payload de login. Validado antes de qualquer ida ao banco: um payload
 * malformado nem chega a gerar consulta.
 */
export const authenticateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type AuthenticateUserInput = z.infer<typeof authenticateUserSchema>;

/**
 * Hash bcrypt (cost 10) de uma senha aleatória descartada na geração — ninguém
 * conhece o texto plano correspondente e ele nunca é usado para autenticar.
 *
 * Existe só para fechar um **oráculo de temporização**: sem ele, um e-mail
 * inexistente retornava falha em ~3 ms (nenhum bcrypt executado) enquanto um
 * e-mail cadastrado com senha errada levava ~58 ms (um bcrypt de cost 10).
 * A diferença de ~20x era estável e permitia enumerar contas cronometrando as
 * respostas, mesmo com os corpos idênticos.
 *
 * Comparando a senha informada contra este hash quando o usuário não existe, os
 * dois caminhos de falha passam a executar exatamente um bcrypt de mesmo cost e
 * custam o mesmo tempo. O resultado da comparação é deliberadamente ignorado.
 *
 * Precisa ter o MESMO cost de `SALT_ROUNDS` em `infra/password.ts` (10) — se um
 * dos dois mudar, o outro tem de acompanhar, ou o oráculo reabre.
 */
const DUMMY_PASSWORD_HASH = '$2b$10$.A3QQW7nV5EHqdMtBj3qHubtQ4EDRcsJeTslvIGtLMM/pr3RIo8Tq';

export interface AuthenticateUserDeps {
  users: UserRepository;
  verifyPassword: PasswordVerifier;
}

/**
 * Autentica um usuário por e-mail e senha.
 *
 * Devolve a projeção pública em caso de sucesso e `null` em qualquer falha —
 * e-mail inexistente e senha errada são indistinguíveis tanto no valor de
 * retorno quanto no tempo gasto. É aqui que mora a regra de autenticação; o
 * provider Credentials do NextAuth é só transporte.
 */
export async function authenticateUser(
  input: AuthenticateUserInput,
  { users, verifyPassword }: AuthenticateUserDeps,
): Promise<PublicUser | null> {
  const email = normalizeEmail(input.email);
  const user = await users.findByEmail(email);

  if (!user) {
    // Gasta o mesmo tempo do caminho "usuário existe, senha errada".
    await verifyPassword(input.password, DUMMY_PASSWORD_HASH);

    return null;
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return toPublicUser(user);
}
