import { z } from 'zod';

import { ConflictError } from '@/core/errors';
import { normalizeEmail, toPublicUser, type PublicUser } from '@/modules/identity/domain/user';

import type { PasswordHasher, UserRepository } from './ports/user-repository';

/**
 * Pelo menos uma letra e pelo menos um dígito.
 *
 * Exportada porque este módulo só importa `zod` e `@/core/errors` — é seguro
 * puxá-lo de um Client Component (`register-form.tsx`) para não duplicar a
 * regra entre validação de servidor e de UI.
 */
export const PASSWORD_RULE = /^(?=.*[A-Za-zÀ-ÿ])(?=.*\d).+$/;

/**
 * Schema do cadastro público.
 *
 * `z.object` descarta chaves desconhecidas por padrão (`.strip()`), então um
 * `role` enviado pelo cliente nunca chega ao use-case — a escalada de
 * privilégio é barrada já na borda, e não por uma checagem posterior.
 */
export const registerUserSchema = z
  .object({
    name: z.string().trim().min(3, 'O nome precisa ter ao menos 3 caracteres'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Informe um e-mail válido')
      .transform(normalizeEmail),
    password: z
      .string()
      .min(8, 'A senha precisa ter ao menos 8 caracteres')
      .regex(PASSWORD_RULE, 'A senha precisa conter ao menos uma letra e um número'),
  })
  .strip();

export type RegisterUserInput = z.infer<typeof registerUserSchema>;

export interface RegisterUserDeps {
  users: UserRepository;
  hashPassword: PasswordHasher;
}

/**
 * Cadastra um novo usuário.
 *
 * Regras:
 *  - o papel é sempre `SOLICITANTE`; quem promove alguém a `GESTOR` é o próprio
 *    banco/administração, nunca o cliente HTTP;
 *  - e-mail duplicado vira `ConflictError` (409 no transporte);
 *  - a senha em texto plano nunca é persistida nem devolvida.
 */
export async function registerUser(
  input: RegisterUserInput,
  { users, hashPassword }: RegisterUserDeps,
): Promise<PublicUser> {
  const email = normalizeEmail(input.email);

  const existing = await users.findByEmail(email);

  if (existing) {
    throw new ConflictError('E-mail já cadastrado', {
      detail: 'Já existe uma conta usando este e-mail.',
    });
  }

  const passwordHash = await hashPassword(input.password);

  const user = await users.create({
    name: input.name.trim(),
    email,
    passwordHash,
    role: 'SOLICITANTE',
  });

  return toPublicUser(user);
}
