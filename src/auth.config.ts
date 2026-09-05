import type { NextAuthConfig } from 'next-auth';

/**
 * Configuração compartilhada do Auth.js.
 *
 * Este arquivo é deliberadamente "edge-safe": nada aqui importa Prisma,
 * bcryptjs ou qualquer coisa que dependa do runtime Node. O `middleware.ts`
 * roda no edge e consome só esta metade; o `auth.ts` completo (com o provider
 * Credentials, que toca o banco) roda no runtime Node.
 */
export const authConfig = {
  // O contrato de API do projeto é versionado; o Auth.js segue a mesma regra.
  basePath: '/api/v1/auth',
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  // Preenchido em `auth.ts`. O middleware não precisa de provider para ler o JWT.
  providers: [],
  callbacks: {
    /** Propaga `id` e `role` do usuário para dentro do token no login. */
    jwt({ token, user }) {
      if (user) {
        const id = user.id ?? token.sub;

        // Fail-closed: uma sessão com identidade '' passaria por `requireSession`
        // e viraria dono de recurso nenhum. Melhor recusar o login.
        if (!id) {
          throw new Error('Login recusado: o provider não devolveu um id de usuário.');
        }

        token.id = id;
        token.role = user.role;
      }

      return token;
    },
    /** Expõe `id` e `role` na sessão lida pelos Server Components e guardas. */
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;

      return session;
    },
  },
} satisfies NextAuthConfig;
