'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Error boundary do App Router para o grupo `(app)/` — captura qualquer
 * exceção não tratada lançada durante a renderização de uma rota autenticada
 * (bug real, falha de rede/servidor), não os erros de validação (`422`) dos
 * formulários, que continuam tratados neles mesmos (`formError`/`toast`) e
 * nunca chegam a lançar até aqui.
 *
 * Propositalmente não exibe `error.message`/stack ao usuário — só loga no
 * console (client) para não vazar detalhe técnico/interno na tela. Em
 * produção, esse `console.error` também é onde uma ferramenta de
 * observabilidade (Sentry etc.) se pluga, se um dia for adicionada.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Algo deu errado</h1>
          </CardTitle>
          <CardDescription>
            Não foi possível carregar esta página. Isso pode ter sido um problema temporário — tente
            novamente em instantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={reset}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
