import {
  rateOccurrence,
  rateOccurrenceSchema,
} from '@/modules/occurrence/application/rate-occurrence';
import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * `POST /api/v1/occurrences/[id]/rating` — o solicitante avalia a própria
 * ocorrência já resolvida.
 *
 * `201`, não `200`: diferente de `POST /status` (atualização de um recurso
 * existente), aqui é criação de um recurso novo — a avaliação. Mesmo 404
 * uniforme de `GET /occurrences/[id]` para quem não é o autor; os demais
 * erros (status não-RESOLVIDA, já avaliada) vêm mapeados do use-case
 * (`rate-occurrence.ts`).
 */
export const POST = route(async (request: Request, { params }: RouteContext) => {
  const session = await requireSession();
  const actor: Actor = { id: session.user.id, role: session.user.role };
  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  const input = rateOccurrenceSchema.parse(body);

  const rating = await rateOccurrence(id, actor, input, {
    occurrences: prismaOccurrenceRepository,
  });

  return Response.json(rating, { status: 201 });
});
