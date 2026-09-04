import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireSession } from '@/core/http/auth-guards';

export const metadata = {
  title: 'Ocorrências · Resolve Aí',
};

/**
 * Server Component protegido. Ainda sem listagem: a consulta real, os filtros e
 * a paginação entram no Dia 2. Nenhum dado fictício é exibido aqui.
 */
export default async function OcorrenciasPage() {
  const session = await requireSession();

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ocorrências</h1>
        <p className="text-muted-foreground text-sm">
          Olá, {session.user.name}. Aqui você acompanha seus registros.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nenhuma ocorrência ainda</CardTitle>
          <CardDescription>A listagem chega no Dia 2.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Esta tela já está protegida por sessão e pronta para receber os dados.
        </CardContent>
      </Card>
    </section>
  );
}
