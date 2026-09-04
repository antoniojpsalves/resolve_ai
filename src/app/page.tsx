import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * Landing pública. As telas de produto vivem no grupo `(app)`, protegido pelo
 * middleware; aqui só apresentamos o projeto e mandamos para a autenticação.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Resolve Aí</h1>
      <p className="text-muted-foreground text-balance">
        Registre ocorrências, acompanhe o andamento e avalie o atendimento — tudo em um lugar só.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/login">Entrar</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/cadastro">Criar conta</Link>
        </Button>
      </div>
    </main>
  );
}
