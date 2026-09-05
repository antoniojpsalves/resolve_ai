import type { ReactNode } from 'react';

/** Moldura das telas públicas de autenticação: card centralizado na viewport. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-muted/30 flex min-h-svh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
