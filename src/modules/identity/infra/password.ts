import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Gera o hash bcrypt de uma senha em texto plano.
 * Compartilhado entre o seed (`prisma/seed.ts`) e o provider Credentials do
 * NextAuth (`src/auth.ts`) — não duplicar esta lógica em outro módulo, ou os
 * dois caminhos podem divergir em cost e não abrir sessão um do outro.
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
