import { problemResponse } from './problem';

type RouteHandler<Args extends unknown[]> = (...args: Args) => Response | Promise<Response>;

/**
 * Envolve um route handler do App Router, convertendo qualquer exceção em uma
 * resposta RFC 7807. Deixa o handler livre para apenas lançar (`ZodError`,
 * `ConflictError`, `ForbiddenError`, ...) em vez de montar respostas de erro.
 *
 * ```ts
 * export const POST = route(async (request: Request) => { ... });
 * ```
 */
export function route<Args extends unknown[]>(
  handler: RouteHandler<Args>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return problemResponse(error);
    }
  };
}
