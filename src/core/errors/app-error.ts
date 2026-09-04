/**
 * Opções extras de um AppError.
 *
 * - `detail`: explicação legível e específica desta ocorrência do erro
 *   (o campo `detail` do RFC 7807).
 * - `extras`: membros adicionais que serão espalhados no corpo do problem+json
 *   (ex.: a lista `errors` de uma falha de validação).
 */
export interface AppErrorOptions {
  detail?: string;
  extras?: Record<string, unknown>;
}

/**
 * Erro de aplicação com código estável e status HTTP associado.
 *
 * Serve de base para as subclasses HTTP (`ValidationError`, `NotFoundError`, ...)
 * e para o `DomainError` (violações de regra de negócio). O formato dos campos
 * espelha o RFC 7807: `title` é o resumo estável do tipo de erro e `detail` é a
 * explicação da ocorrência específica.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly title: string;
  public readonly detail?: string;
  public readonly extras?: Record<string, unknown>;

  /**
   * Alias histórico de `status`, mantido para não quebrar o código escrito
   * antes da introdução das primitivas RFC 7807.
   */
  public readonly statusCode: number;

  constructor(code: string, title: string, status = 400, options: AppErrorOptions = {}) {
    super(title);

    this.name = new.target.name;
    this.code = code;
    this.title = title;
    this.status = status;
    this.statusCode = status;
    this.detail = options.detail;
    this.extras = options.extras;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Type guard para diferenciar um AppError de um erro genérico,
 * útil em handlers que precisam decidir o formato da resposta HTTP.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
