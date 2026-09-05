import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import {
  createOccurrence,
  createOccurrenceSchema,
} from '@/modules/occurrence/application/create-occurrence';
import {
  listOccurrences,
  listOccurrencesQuerySchema,
} from '@/modules/occurrence/application/list-occurrences';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { prismaCategoryRepository } from '@/modules/occurrence/infra/prisma-category-repository';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

/**
 * `GET /api/v1/occurrences` — lista com filtros e paginação (query string).
 *
 * Handler só transporte: parseia a query, delega ao use-case (que aplica o
 * escopo por perfil) e devolve. Query inválida (`status=BANANA`, `page=-1`,
 * ...) vira `ZodError` → 422 no wrapper `route`.
 */
export const GET = route(async (request: Request) => {
  const session = await requireSession();
  const actor: Actor = { id: session.user.id, role: session.user.role };

  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams.entries());
  const query = listOccurrencesQuerySchema.parse(rawQuery);

  const result = await listOccurrences(query, actor, {
    occurrences: prismaOccurrenceRepository,
  });

  return Response.json(result);
});

/**
 * `POST /api/v1/occurrences` — cria uma ocorrência.
 *
 * Qualquer usuário autenticado pode criar; nenhuma checagem de papel aqui —
 * essa é a regra do próprio use-case (`create-occurrence.ts`).
 */
export const POST = route(async (request: Request) => {
  const session = await requireSession();
  const actor: Actor = { id: session.user.id, role: session.user.role };

  const body: unknown = await request.json().catch(() => null);
  const input = createOccurrenceSchema.parse(body);

  const occurrence = await createOccurrence(input, actor, {
    occurrences: prismaOccurrenceRepository,
    categories: prismaCategoryRepository,
  });

  return Response.json(occurrence, { status: 201 });
});
