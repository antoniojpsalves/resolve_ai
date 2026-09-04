import { AppError, type AppErrorOptions } from './app-error';

/**
 * Base para violações de regra de negócio (ex.: "não é possível avaliar uma
 * ocorrência que não foi resolvida"). Diferente dos erros HTTP, o `code` é
 * sempre específico do domínio — por isso ele é obrigatório aqui.
 *
 * Mapeia para 422: o pedido é sintaticamente válido, mas o domínio o recusa.
 * As subclasses concretas chegam no Dia 2, junto com as regras de transição
 * de status da ocorrência.
 */
export class DomainError extends AppError {
  constructor(code: string, title: string, options: AppErrorOptions = {}) {
    super(code, title, 422, options);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
