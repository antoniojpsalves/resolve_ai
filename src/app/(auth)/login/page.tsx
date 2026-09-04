import { Suspense } from 'react';

import { LoginForm } from './login-form';

export const metadata = {
  title: 'Entrar · Resolve Aí',
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
