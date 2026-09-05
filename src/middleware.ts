import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';

import { authConfig } from '@/auth.config';

/**
 * Instância do Auth.js sem providers: no edge só precisamos ler/validar o JWT
 * da sessão, não autenticar credenciais (isso exigiria Prisma, que não roda
 * no edge runtime).
 */
const { auth } = NextAuth(authConfig);

/** Rotas do grupo `(auth)` — visíveis só para quem *não* está logado. */
const AUTH_ROUTES = ['/login', '/cadastro'];

/** Rotas públicas que não pertencem a nenhum dos dois grupos. */
const PUBLIC_ROUTES = ['/'];

/** Para onde vai quem já está autenticado e tenta abrir login/cadastro. */
const AUTHENTICATED_HOME = '/ocorrencias';

function matches(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Fail-closed: tudo que não está explicitamente listado como público ou como
 * rota de autenticação é tratado como rota do grupo `(app)` e exige sessão.
 * Assim uma tela nova nasce protegida por padrão.
 */
export default auth((request) => {
  const { nextUrl } = request;
  const isAuthenticated = Boolean(request.auth?.user);
  const { pathname } = nextUrl;

  if (matches(pathname, AUTH_ROUTES)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(AUTHENTICATED_HOME, nextUrl));
    }

    return NextResponse.next();
  }

  if (matches(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${nextUrl.search}`);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  /**
   * Fora do middleware: os endpoints do Auth.js, o health check, os assets do
   * Next e os arquivos estáticos da pasta `public`.
   */
  matcher: [
    '/((?!api/v1/auth/|api/v1/auth$|api/v1/health$|_next/static/|_next/image/|favicon\\.ico$|[^/]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff|woff2)$).*)',
  ],
};
