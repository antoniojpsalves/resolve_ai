import { AppError, type AppErrorOptions } from './app-error';

/**
 * Base para violações de regra de negócio (ex.: "não é possível avaliar uma
 * ocorrência que não foi resolvida"). Diferente dos erros HTTP, o `code` é
 * sempre específico do domínio — por isso ele é obrigatório aqui.
 *
 * Mapeia para 422: o pedido é sintaticamente válido, mas o domínio o recusa.
 * Sem subclasse concreta ainda — hoje as regras de transição de status
 * (`domain/transitions.ts`) devolvem um `TransitionDenial` que o chamador
 * traduz para erro HTTP, em vez de lançar `DomainError` diretamente. Esta
 * classe existe para quando uma regra de negócio precisar lançar (não só
 * retornar um motivo), sem cada uma inventar seu próprio código de status.
 */
export class DomainError extends AppError {
  constructor(code: string, title: string, options: AppErrorOptions = {}) {
    super(code, title, 422, options);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
