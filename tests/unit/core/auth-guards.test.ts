import type { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, UnauthorizedError } from '@/core/errors';
import { requireRole, requireSession } from '@/core/http/auth-guards';

// `auth()` é a única dependência das guardas; mockado para testá-las sem Next.
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

const { auth } = await import('@/auth');
const authMock = vi.mocked(auth as unknown as () => Promise<Session | null>);

function sessionWith(role: 'SOLICITANTE' | 'GESTOR'): Session {
  return {
    user: {
      id: 'user-1',
      name: 'Ana Paula Ribeiro',
      email: 'ana@resolveai.com',
      role,
    },
    expires: '2026-10-04T00:00:00.000Z',
  } as Session;
}

beforeEach(() => {
  authMock.mockReset();
});

describe('requireSession', () => {
  it('devolve a sessão quando há usuário autenticado', async () => {
    const session = sessionWith('SOLICITANTE');
    authMock.mockResolvedValue(session);

    await expect(requireSession()).resolves.toBe(session);
  });

  it('lança UnauthorizedError quando não há sessão', async () => {
    authMock.mockResolvedValue(null);

    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(requireSession()).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('lança UnauthorizedError quando a sessão existe mas não tem usuário', async () => {
    authMock.mockResolvedValue({ expires: '2026-10-04T00:00:00.000Z' } as Session);

    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('requireRole', () => {
  it('devolve a sessão quando o papel confere', async () => {
    const session = sessionWith('GESTOR');
    authMock.mockResolvedValue(session);

    await expect(requireRole('GESTOR')).resolves.toBe(session);
  });

  it('lança ForbiddenError quando o papel é diferente', async () => {
    authMock.mockResolvedValue(sessionWith('SOLICITANTE'));

    await expect(requireRole('GESTOR')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireRole('GESTOR')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('lança UnauthorizedError (401, não 403) quando não há sessão', async () => {
    authMock.mockResolvedValue(null);

    await expect(requireRole('GESTOR')).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(requireRole('GESTOR')).rejects.not.toBeInstanceOf(ForbiddenError);
  });

  it('deixa um SOLICITANTE passar quando o papel exigido é SOLICITANTE', async () => {
    const session = sessionWith('SOLICITANTE');
    authMock.mockResolvedValue(session);

    await expect(requireRole('SOLICITANTE')).resolves.toBe(session);
  });
});
