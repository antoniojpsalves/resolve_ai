import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { authConfig } from '@/auth.config';
import {
  authenticateUser,
  authenticateUserSchema,
} from '@/modules/identity/application/authenticate-user';
import { verifyPassword } from '@/modules/identity/infra/password';
import { prismaUserRepository } from '@/modules/identity/infra/prisma-user-repository';

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
       * Só transporte: valida a forma do payload, delega ao use-case
       * `authenticateUser` e traduz o resultado para o contrato do Auth.js.
       * A regra de autenticação — incluindo a defesa contra o oráculo de
       * temporização — vive na camada de aplicação e é testável sem subir o Next.
       *
       * Retornar `null` faz o Auth.js responder com um erro genérico
       * (`CredentialsSignin`). Os três caminhos de falha — payload inválido,
       * e-mail inexistente e senha errada — devolvem a mesma resposta.
       */
      async authorize(rawCredentials) {
        const parsed = authenticateUserSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const user = await authenticateUser(parsed.data, {
          users: prismaUserRepository,
          verifyPassword,
        });

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
