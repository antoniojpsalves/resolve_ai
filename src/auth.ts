import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import { authConfig } from '@/auth.config';
import { prisma } from '@/core/db/prisma';
import type { Role } from '@/modules/identity/domain/role';
import { normalizeEmail } from '@/modules/identity/domain/user';
import { verifyPassword } from '@/modules/identity/infra/password';

/**
 * Validação mínima do payload de login. Feita antes de qualquer ida ao banco:
 * um payload malformado nem chega a gerar consulta.
 */
const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credenciais',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      /**
       * Retornar `null` faz o Auth.js responder com um erro genérico
       * (`CredentialsSignin`). Os três caminhos de falha — payload inválido,
       * e-mail inexistente e senha errada — devolvem exatamente a mesma coisa,
       * de propósito: a resposta não pode revelar se o e-mail está cadastrado.
       */
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const email = normalizeEmail(parsed.data.email);
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          return null;
        }

        const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
        };
      },
    }),
  ],
});
