import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import { getOccurrence } from '@/modules/occurrence/application/get-occurrence';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * `GET /api/v1/occurrences/[id]/history` — linha do tempo de uma ocorrência.
 *
 * Reusa `getOccurrence` (mesma autorização e mesmo 404 uniforme entre
 * "não existe" e "existe mas não é sua") e devolve só o array de histórico —
 * um recorte de `GET /occurrences/[id]`, não uma regra nova.
 */
export const GET = route(async (_request: Request, { params }: RouteContext) => {
  const session = await requireSession();
  const actor: Actor = { id: session.user.id, role: session.user.role };
  const { id } = await params;

  const detail = await getOccurrence(id, actor, { occurrences: prismaOccurrenceRepository });

  return Response.json({ data: detail.history });
});
