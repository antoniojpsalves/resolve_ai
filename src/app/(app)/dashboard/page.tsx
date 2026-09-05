import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRoleOrRedirect } from '@/core/http/auth-guards';

export const metadata = {
  title: 'Dashboard · Resolve Aí',
};

/**
 * Tela restrita a GESTOR — a prova do RBAC ponta a ponta.
 *
 * A decisão é tomada no servidor pela guarda `requireRoleOrRedirect`, não por
 * um `if` de UI: um SOLICITANTE que digite a URL na barra de endereços é
 * mandado de volta para `/ocorrencias`.
 */
export default async function DashboardPage() {
  await requireRoleOrRedirect('GESTOR');

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Visão gerencial — acesso restrito a gestores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nenhum indicador ainda</CardTitle>
          <CardDescription>
            Nenhum número é exibido enquanto não houver agregação real sobre o banco.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Assim que houver ocorrências suficientes, os indicadores gerenciais aparecem aqui.
        </CardContent>
      </Card>
    </section>
  );
}
