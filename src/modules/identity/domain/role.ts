/**
 * Papéis de acesso do sistema.
 *
 * Declarado no domínio (e não importado do `@prisma/client`) para manter a
 * regra de ouro do projeto: a camada de domínio não conhece infraestrutura.
 * Os valores são idênticos aos do enum `Role` do Prisma, então os dois tipos
 * são mutuamente atribuíveis sem conversão.
 */
export const ROLES = ['SOLICITANTE', 'GESTOR'] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
