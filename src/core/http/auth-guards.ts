import type { Session } from 'next-auth';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { ForbiddenError, UnauthorizedError } from '@/core/errors';
import type { Role } from '@/modules/identity/domain/role';

/**
 * Guardas de autorização usadas na camada de aplicação/rota — Server
 * Components, layouts e route handlers. A UI pode esconder um botão, mas quem
 * decide o acesso é este módulo, do lado do servidor.
 */

/** Retorna a sessão atual ou lança `UnauthorizedError` (401). */
export async function requireSession(): Promise<Session> {
  const session = await auth();

  if (!session?.user) {
    throw new UnauthorizedError('É necessário estar autenticado', {
      detail: 'Faça login para acessar este recurso.',
    });
  }

  return session;
}

/**
 * Retorna a sessão atual se o usuário tiver o papel exigido.
 * Sem sessão → `UnauthorizedError` (401); sessão com papel errado →
 * `ForbiddenError` (403).
 */
export async function requireRole(role: Role): Promise<Session> {
  const session = await requireSession();

  if (session.user.role !== role) {
    throw new ForbiddenError('Acesso restrito', {
      detail: `Este recurso exige o papel ${role}.`,
    });
  }

  return session;
}

/**
 * Variante de `requireSession` para Server Components/layouts: em vez de
 * deixar o erro subir para a página de erro do Next, redireciona para
 * `unauthorizedTo`. Centraliza o padrão try/catch que antes se repetia em
 * cada tela protegida.
 */
export async function requireSessionOrRedirect(unauthorizedTo = '/login'): Promise<Session> {
  try {
    return await requireSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(unauthorizedTo);
    }

    throw error;
  }
}

/**
 * Variante de `requireRole` para Server Components/layouts: sem sessão manda
 * para `unauthorizedTo`, com papel errado manda para `forbiddenTo`.
 */
export async function requireRoleOrRedirect(
  role: Role,
  options: { unauthorizedTo?: string; forbiddenTo?: string } = {},
): Promise<Session> {
  const { unauthorizedTo = '/login', forbiddenTo = '/ocorrencias' } = options;

  try {
    return await requireRole(role);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect(forbiddenTo);
    }

    if (error instanceof UnauthorizedError) {
      redirect(unauthorizedTo);
    }

    throw error;
  }
}
