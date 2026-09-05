import type { Role } from './role';

/** Usuário como o domínio o enxerga — inclui o hash, nunca a senha em claro. */
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

/** Projeção segura do usuário: o que pode atravessar a fronteira HTTP. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Remove o `passwordHash` (e qualquer outro campo interno) antes de expor o
 * usuário. Único caminho autorizado para serializar um usuário numa resposta.
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/** Normaliza o e-mail para a forma canônica usada como chave única. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
