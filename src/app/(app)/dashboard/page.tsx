import { redirect } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ForbiddenError, UnauthorizedError } from '@/core/errors';
import { requireRole } from '@/core/http/auth-guards';

export const metadata = {
  title: 'Dashboard · Resolve Aí',
};

/**
 * Tela restrita a GESTOR — a prova do RBAC ponta a ponta.
 *
 * A decisão é tomada no servidor pela guarda `requireRole`, não por um `if` de
 * UI: um SOLICITANTE que digite a URL na barra de endereços é mandado de volta
 * para `/ocorrencias`.
 */
export default async function DashboardPage() {
  try {
    await requireRole('GESTOR');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect('/ocorrencias');
    }

    if (error instanceof UnauthorizedError) {
      redirect('/login');
    }

    throw error;
  }

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
          <CardTitle>Indicadores em construção</CardTitle>
          <CardDescription>Os gráficos e métricas chegam no Dia 3.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Nenhum número é exibido enquanto não houver agregação real sobre o banco.
        </CardContent>
      </Card>
    </section>
  );
}
