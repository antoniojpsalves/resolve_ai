import { addComment, addCommentSchema } from '@/modules/occurrence/application/add-comment';
import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * `POST /api/v1/occurrences/[id]/comments` — adiciona um comentário.
 *
 * Mesmo 404 uniforme de `GET /occurrences/[id]` para quem não pode ver a
 * ocorrência — decisão do use-case (`add-comment.ts`).
 */
export const POST = route(async (request: Request, { params }: RouteContext) => {
  const session = await requireSession();
  const actor: Actor = { id: session.user.id, role: session.user.role };
  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  const input = addCommentSchema.parse(body);

  const comment = await addComment(id, input, actor, {
    occurrences: prismaOccurrenceRepository,
  });

  return Response.json(comment, { status: 201 });
});
