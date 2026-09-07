import { AppError, type AppErrorOptions } from './app-error';

/**
 * Erros de transporte HTTP.
 *
 * Cada subclasse fixa o par (`code`, `status`) e aceita um `title` opcional
 * quando a mensagem padrão em português não descreve bem o caso.
 */

/** 422 — payload sintaticamente válido, mas semanticamente incorreto. */
export class ValidationError extends AppError {
  constructor(title = 'Dados inválidos', options: AppErrorOptions = {}) {
    super('VALIDATION_ERROR', title, 422, options);
  }
}

/** 401 — sem sessão ou com credenciais inválidas. */
export class UnauthorizedError extends AppError {
  constructor(title = 'Não autenticado', options: AppErrorOptions = {}) {
    super('UNAUTHORIZED', title, 401, options);
  }
}

/** 403 — autenticado, porém sem permissão para a operação. */
export class ForbiddenError extends AppError {
  constructor(title = 'Acesso negado', options: AppErrorOptions = {}) {
    super('FORBIDDEN', title, 403, options);
  }
}

/** 404 — recurso inexistente. */
export class NotFoundError extends AppError {
  constructor(title = 'Recurso não encontrado', options: AppErrorOptions = {}) {
    super('NOT_FOUND', title, 404, options);
  }
}

/** 409 — conflito com o estado atual do recurso (ex.: e-mail já cadastrado). */
export class ConflictError extends AppError {
  constructor(title = 'Conflito com o estado atual do recurso', options: AppErrorOptions = {}) {
    super('CONFLICT', title, 409, options);
  }
}

/** 413 — corpo da requisição maior que o limite aceito (ex.: upload acima de 5 MB). */
export class PayloadTooLargeError extends AppError {
  constructor(title = 'Arquivo muito grande', options: AppErrorOptions = {}) {
    super('PAYLOAD_TOO_LARGE', title, 413, options);
  }
}

/** 503 — dependência externa (ex.: banco de dados) indisponível ou não pronta. */
export class ServiceUnavailableError extends AppError {
  constructor(title = 'Serviço indisponível', options: AppErrorOptions = {}) {
    super('SERVICE_UNAVAILABLE', title, 503, options);
  }
}
