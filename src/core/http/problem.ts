import { ZodError } from 'zod';

import { AppError, isAppError } from '@/core/errors';

/** Namespace dos `type` do RFC 7807 deste projeto. */
export const PROBLEM_TYPE_BASE = 'https://resolveai.app/errors';

/** Content-Type obrigatório de uma resposta RFC 7807. */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/**
 * Corpo de uma resposta RFC 7807. Os quatro campos nomeados são os do RFC;
 * membros de extensão (ex.: `errors`) entram pelo index signature.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  [member: string]: unknown;
}

/** Converte `VALIDATION_ERROR` / `NotFound` em `validation-error` / `not-found`. */
export function toKebabCase(code: string): string {
  return code
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/** Monta a URI de `type` a partir do código estável do erro. */
export function problemType(code: string): string {
  return `${PROBLEM_TYPE_BASE}/${toKebabCase(code)}`;
}

function zodErrorToProblem(error: ZodError): ProblemDetails {
  return {
    type: problemType('VALIDATION_ERROR'),
    title: 'Dados inválidos',
    status: 422,
    detail: 'A requisição não passou na validação do schema.',
    errors: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

function appErrorToProblem(error: AppError): ProblemDetails {
  const problem: ProblemDetails = {
    type: problemType(error.code),
    title: error.title,
    status: error.status,
  };

  if (error.detail !== undefined) {
    problem.detail = error.detail;
  }

  return { ...problem, ...error.extras };
}

function unknownErrorToProblem(): ProblemDetails {
  return {
    type: problemType('INTERNAL_SERVER_ERROR'),
    title: 'Erro interno do servidor',
    status: 500,
    detail: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
  };
}

/**
 * Traduz qualquer erro para o corpo RFC 7807 correspondente.
 *
 * Erros desconhecidos viram um 500 genérico: a mensagem interna é logada no
 * servidor e **nunca** devolvida ao cliente, para não vazar detalhes de
 * implementação (stack, SQL, nomes de tabela).
 */
export function toProblem(error: unknown): ProblemDetails {
  if (error instanceof ZodError) {
    return zodErrorToProblem(error);
  }

  if (isAppError(error)) {
    return appErrorToProblem(error);
  }

  console.error('[problem] erro não tratado:', error);

  return unknownErrorToProblem();
}

/** Constrói a `Response` RFC 7807 pronta para ser devolvida por um route handler. */
export function problemResponse(error: unknown): Response {
  const problem = toProblem(error);

  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: { 'Content-Type': PROBLEM_CONTENT_TYPE },
  });
}
