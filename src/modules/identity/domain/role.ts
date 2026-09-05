/**
 * Papéis de acesso do sistema.
 *
 * Declarado no domínio (e não importado do `@prisma/client`) para manter a
 * regra de ouro do projeto: a camada de domínio não conhece infraestrutura.
 * Os valores são idênticos aos do enum `Role` do Prisma, então os dois tipos
 * são mutuamente atribuíveis sem conversão.
 */
export type Role = 'SOLICITANTE' | 'GESTOR';
