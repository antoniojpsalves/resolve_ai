import {
  changeOccurrenceStatus,
  changeOccurrenceStatusSchema,
} from '@/modules/occurrence/application/change-occurrence-status';
import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * `POST /api/v1/occurrences/[id]/status` — muda o status de uma ocorrência.
 *
 * `200`, não `201`: é atualização de um recurso existente, não criação de um
 * novo. Mesmo 404 uniforme de `GET /occurrences/[id]` para quem não pode nem
 * ver a ocorrência; os demais erros (permissão da transição, campo
 * obrigatório faltando, status terminal/transição inválida) vêm mapeados do
 * use-case (`change-occurrence-status.ts`).
 */
export const POST = route(async (request: Request, { params }: RouteContext) => {
  const session = await requireSession();
  const actor: Actor = { id: session.user.id, role: session.user.role };
  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  const input = changeOccurrenceStatusSchema.parse(body);

  const occurrence = await changeOccurrenceStatus(id, actor, input, {
    occurrences: prismaOccurrenceRepository,
  });

  return Response.json(occurrence);
});
