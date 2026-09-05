import { PrismaClient } from '@prisma/client';

/**
 * Singleton do Prisma Client, cacheado em `globalThis` para não estourar
 * o pool de conexões durante hot reload do Next.js em desenvolvimento.
 * Sem lógica de negócio aqui.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
