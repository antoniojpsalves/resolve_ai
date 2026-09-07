import type { CategoryRepository, CategorySummary } from './ports/category-repository';

export interface ListCategoriesDeps {
  categories: CategoryRepository;
}

/**
 * Lista o catálogo de categorias ativas, ordenadas por nome — usado pelo
 * formulário de criação de ocorrência e pelo filtro de categoria da listagem,
 * via `GET /api/v1/categories`.
 *
 * Qualquer usuário autenticado pode listar; não há escopo por papel aqui
 * (a checagem de sessão é responsabilidade da rota, via `requireSession`).
 * A ordenação defensiva por nome não depende de o repositório já devolver
 * ordenado — reforça a garantia mesmo que uma implementação futura de
 * `listActive` (ou um fake de teste) não ordene por conta própria.
 */
export async function listCategories({
  categories,
}: ListCategoriesDeps): Promise<CategorySummary[]> {
  const rows = await categories.listActive();

  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}
