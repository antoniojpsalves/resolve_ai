'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Error boundary do grupo `(auth)/` (login/cadastro). O volume de código
 * aqui é pequeno (formulários com validação já tratada localmente via
 * `formError`/toast), mas não nulo — `register-form.tsx` tem ~220 linhas de
 * lógica (react-hook-form + zod + upload) e uma exceção não tratada ali
 * quebraria a única porta de entrada do app para quem ainda não tem sessão,
 * sem alternativa de navegação (diferente de uma rota dentro de `(app)/`,
 * onde o usuário sempre tem o cabeçalho para tentar outra tela). Por isso
 * ganha o mesmo tratamento do `(app)/error.tsx`, e não fica de fora.
 */
export default function AuthError({
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
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Algo deu errado</h1>
        </CardTitle>
        <CardDescription>
          Não foi possível carregar esta página. Isso pode ter sido um problema temporário —
          tente novamente em instantes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={reset}>
          Tentar de novo
        </Button>
      </CardContent>
    </Card>
  );
}
