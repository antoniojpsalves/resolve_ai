import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import { listCategories } from '@/modules/occurrence/application/list-categories';
import { prismaCategoryRepository } from '@/modules/occurrence/infra/prisma-category-repository';

/**
 * `GET /api/v1/categories` — catálogo de categorias ativas, ordenadas por
 * nome. Qualquer usuário autenticado pode listar; sem sessão → 401
 * (`requireSession`).
 */
export const GET = route(async () => {
  await requireSession();

  const data = await listCategories({ categories: prismaCategoryRepository });

  return Response.json({ data });
});
