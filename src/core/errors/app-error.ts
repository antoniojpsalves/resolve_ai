/**
 * Erro de aplicação com código estável e status HTTP associado.
 * Serve de base para os erros de domínio das tarefas futuras
 * (Prisma/NextAuth ainda não existem nesta tarefa).
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Type guard para diferenciar um AppError de um erro genérico,
 * útil em handlers que precisam decidir o formato da resposta HTTP.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
