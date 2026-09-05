'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

/**
 * O cliente do Auth.js (`next-auth/react`) monta as URLs a partir de um
 * `basePath` global que por padrão é `/api/auth`. Como este projeto versiona a
 * API em `/api/v1`, precisamos informá-lo explicitamente aqui — caso contrário
 * `signIn`/`signOut` bateriam num endpoint inexistente.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath="/api/v1/auth" refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
