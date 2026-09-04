import { prisma } from '@/core/db/prisma';

/** Nunca cacheado: um health check pré-renderizado não vale nada. */
export const dynamic = 'force-dynamic';

/**
 * `GET /api/v1/health` — público, usado pelo smoke test do container.
 * Faz um `SELECT 1` real: se o Postgres estiver fora, responde 503.
 */
export async function GET(): Promise<Response> {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({ status: 'ok', db: 'up', timestamp });
  } catch (error) {
    console.error('[health] banco indisponível:', error);

    return Response.json({ status: 'error', db: 'down', timestamp }, { status: 503 });
  }
}
