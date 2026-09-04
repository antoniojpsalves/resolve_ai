import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Gera o hash bcrypt de uma senha em texto plano.
 * Compartilhado entre o seed (Tarefa 2) e o provider Credentials do
 * NextAuth (Tarefa 3) — não duplicar esta lógica em outro módulo.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Verifica se uma senha em texto plano corresponde ao hash armazenado.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
