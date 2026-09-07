import { ServiceUnavailableError } from '@/core/errors';
import { route } from '@/core/http/handler';
import { prisma } from '@/core/db/prisma';

/** Nunca cacheado: um health check pré-renderizado não vale nada. */
export const dynamic = 'force-dynamic';

/**
 * `GET /api/v1/health` — público, usado por um smoke test após o container
 * subir, para confirmar que a aplicação está no ar e o banco acessível
 * antes de liberar tráfego.
 *
 * Toca o schema (`SELECT 1 FROM "User" LIMIT 1`), não só a conexão: um
 * `SELECT 1` puro prova que o Postgres está de pé, mas aprovaria uma imagem
 * cujo banco não tem migration aplicada — exatamente o cenário em que o
 * container não consegue cadastrar ninguém. Segue a mesma convenção de erro
 * das demais rotas (`route()` + problem+json via `ServiceUnavailableError`).
 */
export const GET = route(async (): Promise<Response> => {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
  } catch (error) {
    console.error('[health] banco indisponível ou schema ausente:', error);

    throw new ServiceUnavailableError('Serviço indisponível', {
      detail: 'Banco de dados inacessível ou sem o schema esperado.',
      extras: { db: 'down', timestamp },
    });
  }

  return Response.json({ status: 'ok', db: 'up', timestamp });
});
