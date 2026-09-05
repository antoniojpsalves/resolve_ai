import { Suspense } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { LoginForm } from './login-form';

export const metadata = {
  title: 'Entrar · Resolve Aí',
};

/**
 * O cabeçalho fica aqui, no Server Component, e não dentro do `LoginForm`.
 *
 * O formulário lê `useSearchParams()` (para o `callbackUrl`), o que obriga a
 * envolvê-lo num `Suspense`; durante a prerenderização estática o Next entrega o
 * `fallback` no HTML inicial. Com o título dentro do formulário, o `<h1>` só
 * aparecia depois da hidratação e a página nascia sem heading de nível 1.
 */
export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>Entrar</h1>
        </CardTitle>
        <CardDescription>Acesse sua conta para acompanhar suas ocorrências.</CardDescription>
      </CardHeader>

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </Card>
  );
}
