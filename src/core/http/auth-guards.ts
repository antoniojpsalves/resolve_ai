import type { Session } from 'next-auth';

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
