import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { UnauthorizedError } from '@/core/errors';
import { requireSession } from '@/core/http/auth-guards';

import { SignOutButton } from './sign-out-button';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Resolve Aí';

const ROLE_LABEL = {
  GESTOR: 'Gestor',
  SOLICITANTE: 'Solicitante',
} as const;

/**
 * Layout das rotas autenticadas.
 *
 * O middleware já barra o acesso sem sessão, mas a guarda é repetida aqui de
 * propósito: o middleware é uma conveniência de UX, a autorização de verdade
 * acontece no servidor, junto do dado.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  let session;

  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/login');
    }

    throw error;
  }

  const { user } = session;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-6">
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
            <Badge variant={user.role === 'GESTOR' ? 'default' : 'secondary'}>
              {ROLE_LABEL[user.role]}
            </Badge>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
