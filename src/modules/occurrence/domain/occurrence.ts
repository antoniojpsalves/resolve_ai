import type { Role } from '@/modules/identity/domain/role';

import type { OccurrenceStatus } from './status';
import type { Priority } from './priority';

/**
 * Recorte da ocorrência com os campos que as regras de domínio (transições e
 * permissões) precisam ler. Não é o modelo Prisma completo — só o suficiente
 * para decidir "quem pode fazer o quê" sem tocar em infraestrutura.
 */
export type Occurrence = {
  id: string;
  code: string;
  status: OccurrenceStatus;
  priority: Priority;
  createdById: string;
  assignedToId?: string;
  resolutionNote?: string;
};

/** Quem está tentando executar uma ação sobre uma ocorrência. */
export type Actor = {
  id: string;
  role: Role;
};
