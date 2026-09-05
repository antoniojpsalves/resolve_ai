import type { DefaultSession } from 'next-auth';

import type { Role } from '@/modules/identity/domain/role';

/**
 * Augmentação dos tipos do Auth.js para que `session.user.id` e
 * `session.user.role` existam e sejam tipados — sem `any` e sem cast nas
 * guardas de autorização.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }

  interface User {
    role: Role;
  }
}

/**
 * O JWT é augmentado em `@auth/core/jwt`, e não em `next-auth/jwt`: este último
 * apenas reexporta (`export * from '@auth/core/jwt'`), e um `export *` não
 * participa de declaration merging — augmentar `next-auth/jwt` criaria uma
 * interface nova em vez de estender a original, e `token.id` continuaria
 * caindo no index signature `unknown` do `JWT`.
 */
declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}
