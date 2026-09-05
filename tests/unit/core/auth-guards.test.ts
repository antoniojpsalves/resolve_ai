import type { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, UnauthorizedError } from '@/core/errors';
import {
  requireAnyRole,
  requireRole,
  requireRoleOrRedirect,
  requireSession,
  requireSessionOrRedirect,
} from '@/core/http/auth-guards';

// `auth()` é a única dependência das guardas; mockado para testá-las sem Next.
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

// `redirect()` lança de verdade dentro do Next (interrompe a renderização);
// aqui simulamos o mesmo comportamento para poder afirmar o destino chamado.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const { auth } = await import('@/auth');
const { redirect } = await import('next/navigation');
const authMock = vi.mocked(auth as unknown as () => Promise<Session | null>);
const redirectMock = vi.mocked(redirect);

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
  redirectMock.mockClear();
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

describe('requireAnyRole', () => {
  it('devolve a sessão quando o papel do ator está na lista', async () => {
    const session = sessionWith('GESTOR');
    authMock.mockResolvedValue(session);

    await expect(requireAnyRole(['SOLICITANTE', 'GESTOR'])).resolves.toBe(session);
  });

  it('lança ForbiddenError quando o papel não está na lista', async () => {
    authMock.mockResolvedValue(sessionWith('SOLICITANTE'));

    await expect(requireAnyRole(['GESTOR'])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireAnyRole(['GESTOR'])).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('lança UnauthorizedError (401, não 403) quando não há sessão', async () => {
    authMock.mockResolvedValue(null);

    await expect(requireAnyRole(['SOLICITANTE', 'GESTOR'])).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(requireAnyRole(['SOLICITANTE', 'GESTOR'])).rejects.not.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('requireRole é o caso particular de requireAnyRole com um papel só', async () => {
    authMock.mockResolvedValue(sessionWith('SOLICITANTE'));

    await expect(requireRole('SOLICITANTE')).resolves.toEqual(
      await requireAnyRole(['SOLICITANTE']),
    );
  });
});

describe('requireSessionOrRedirect', () => {
  it('devolve a sessão quando há usuário autenticado', async () => {
    const session = sessionWith('SOLICITANTE');
    authMock.mockResolvedValue(session);

    await expect(requireSessionOrRedirect()).resolves.toBe(session);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redireciona para /login (padrão) quando não há sessão', async () => {
    authMock.mockResolvedValue(null);

    await expect(requireSessionOrRedirect()).rejects.toThrow('REDIRECT:/login');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('redireciona para o destino informado quando não há sessão', async () => {
    authMock.mockResolvedValue(null);

    await expect(requireSessionOrRedirect('/entrar')).rejects.toThrow('REDIRECT:/entrar');
    expect(redirectMock).toHaveBeenCalledWith('/entrar');
  });
});

describe('requireRoleOrRedirect', () => {
  it('devolve a sessão quando o papel confere', async () => {
    const session = sessionWith('GESTOR');
    authMock.mockResolvedValue(session);

    await expect(requireRoleOrRedirect('GESTOR')).resolves.toBe(session);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redireciona para /login (padrão) quando não há sessão', async () => {
    authMock.mockResolvedValue(null);

    await expect(requireRoleOrRedirect('GESTOR')).rejects.toThrow('REDIRECT:/login');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('redireciona para /ocorrencias (padrão) quando o papel é diferente', async () => {
    authMock.mockResolvedValue(sessionWith('SOLICITANTE'));

    await expect(requireRoleOrRedirect('GESTOR')).rejects.toThrow('REDIRECT:/ocorrencias');
    expect(redirectMock).toHaveBeenCalledWith('/ocorrencias');
  });

  it('respeita os destinos customizados de unauthorizedTo/forbiddenTo', async () => {
    authMock.mockResolvedValue(sessionWith('SOLICITANTE'));

    await expect(
      requireRoleOrRedirect('GESTOR', { unauthorizedTo: '/entrar', forbiddenTo: '/sem-acesso' }),
    ).rejects.toThrow('REDIRECT:/sem-acesso');
    expect(redirectMock).toHaveBeenCalledWith('/sem-acesso');
  });
});
