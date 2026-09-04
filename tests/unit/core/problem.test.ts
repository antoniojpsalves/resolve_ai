import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  AppError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/core/errors';
import {
  PROBLEM_CONTENT_TYPE,
  problemResponse,
  problemType,
  toKebabCase,
  toProblem,
} from '@/core/http/problem';

describe('toKebabCase / problemType', () => {
  it('converte SCREAMING_SNAKE_CASE para kebab-case', () => {
    expect(toKebabCase('VALIDATION_ERROR')).toBe('validation-error');
    expect(toKebabCase('INTERNAL_SERVER_ERROR')).toBe('internal-server-error');
  });

  it('converte camelCase e PascalCase para kebab-case', () => {
    expect(toKebabCase('notFound')).toBe('not-found');
    expect(toKebabCase('OccurrenceNotFound')).toBe('occurrence-not-found');
  });

  it('monta a URI de type no namespace do projeto', () => {
    expect(problemType('CONFLICT')).toBe('https://resolveai.app/errors/conflict');
  });
});

describe('toProblem — subclasses de AppError', () => {
  const cases = [
    {
      name: 'ValidationError',
      error: new ValidationError(),
      status: 422,
      code: 'validation-error',
    },
    {
      name: 'UnauthorizedError',
      error: new UnauthorizedError(),
      status: 401,
      code: 'unauthorized',
    },
    { name: 'ForbiddenError', error: new ForbiddenError(), status: 403, code: 'forbidden' },
    { name: 'NotFoundError', error: new NotFoundError(), status: 404, code: 'not-found' },
    { name: 'ConflictError', error: new ConflictError(), status: 409, code: 'conflict' },
  ] as const;

  it.each(cases)('$name mapeia para $status no formato RFC 7807', ({ error, status, code }) => {
    const problem = toProblem(error);

    expect(problem.status).toBe(status);
    expect(problem.type).toBe(`https://resolveai.app/errors/${code}`);
    expect(typeof problem.title).toBe('string');
    expect(problem.title.length).toBeGreaterThan(0);
  });

  it('inclui o detail quando informado e o omite quando ausente', () => {
    expect(toProblem(new NotFoundError('Ocorrência não encontrada')).detail).toBeUndefined();

    expect(
      toProblem(new ConflictError('E-mail já cadastrado', { detail: 'Tente outro e-mail.' }))
        .detail,
    ).toBe('Tente outro e-mail.');
  });

  it('espalha os membros de extensão no corpo', () => {
    const problem = toProblem(
      new ValidationError('Dados inválidos', { extras: { errors: [{ path: 'email' }] } }),
    );

    expect(problem.errors).toEqual([{ path: 'email' }]);
  });

  it('mapeia DomainError para 422 mantendo o code do domínio', () => {
    const problem = toProblem(
      new DomainError('OCCURRENCE_ALREADY_RESOLVED', 'Ocorrência já resolvida'),
    );

    expect(problem.status).toBe(422);
    expect(problem.type).toBe('https://resolveai.app/errors/occurrence-already-resolved');
    expect(problem.title).toBe('Ocorrência já resolvida');
  });

  it('respeita o status de um AppError construído diretamente', () => {
    const problem = toProblem(new AppError('TEAPOT', 'Sou um bule', 418));

    expect(problem.status).toBe(418);
    expect(problem.type).toBe('https://resolveai.app/errors/teapot');
  });
});

describe('toProblem — ZodError', () => {
  const schema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
  });

  function zodErrorFrom(input: unknown) {
    const result = schema.safeParse(input);

    if (result.success) {
      throw new Error('esperava falha de validação');
    }

    return result.error;
  }

  it('vira 422 com a lista de errors', () => {
    const problem = toProblem(zodErrorFrom({ name: 'ab', email: 'nao-eh-email' }));

    expect(problem.status).toBe(422);
    expect(problem.type).toBe('https://resolveai.app/errors/validation-error');
    expect(problem.title).toBe('Dados inválidos');

    const errors = problem.errors as { path: string; message: string }[];

    expect(errors).toHaveLength(2);
    expect(errors.map((issue) => issue.path).sort()).toEqual(['email', 'name']);
    errors.forEach((issue) => expect(typeof issue.message).toBe('string'));
  });

  it('serializa caminhos aninhados com ponto', () => {
    const nested = z.object({ user: z.object({ email: z.string().email() }) });
    const result = nested.safeParse({ user: { email: 'x' } });

    if (result.success) {
      throw new Error('esperava falha de validação');
    }

    const errors = toProblem(result.error).errors as { path: string }[];

    expect(errors[0].path).toBe('user.email');
  });
});

describe('toProblem — erro desconhecido', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('vira 500 genérico sem vazar a mensagem interna', () => {
    const problem = toProblem(new Error('connect ECONNREFUSED 10.0.0.1:5432'));

    expect(problem.status).toBe(500);
    expect(problem.type).toBe('https://resolveai.app/errors/internal-server-error');
    expect(problem.title).toBe('Erro interno do servidor');
    expect(JSON.stringify(problem)).not.toContain('ECONNREFUSED');
  });

  it('loga o erro original no servidor', () => {
    const original = new Error('segredo interno');

    toProblem(original);

    expect(console.error).toHaveBeenCalledWith('[problem] erro não tratado:', original);
  });

  it('trata valores lançados que não são Error', () => {
    expect(toProblem('string solta').status).toBe(500);
    expect(toProblem(undefined).status).toBe(500);
  });
});

describe('problemResponse', () => {
  it('devolve o Content-Type application/problem+json e o status do erro', async () => {
    const response = problemResponse(new ForbiddenError());

    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Type')).toBe(PROBLEM_CONTENT_TYPE);

    await expect(response.json()).resolves.toMatchObject({
      type: 'https://resolveai.app/errors/forbidden',
      status: 403,
      title: 'Acesso negado',
    });
  });
});
