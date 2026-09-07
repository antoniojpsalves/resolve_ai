import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import { getOccurrence } from '@/modules/occurrence/application/get-occurrence';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * `GET /api/v1/occurrences/[id]` — detalhe com histórico, comentários e
 * avaliação.
 *
 * Ocorrência inexistente e ocorrência de outra pessoa (para um solicitante)
 * chegam ao cliente como o mesmo 404 — decisão do use-case
 * (`get-occurrence.ts`), não desta rota.
 */
export const GET = route(async (_request: Request, { params }: RouteContext) => {
  const session = await requireSession();
  const actor: Actor = { id: session.user.id, role: session.user.role };
  const { id } = await params;

  const detail = await getOccurrence(id, actor, { occurrences: prismaOccurrenceRepository });

  return Response.json(detail);
});
