/**
 * Recorte mínimo de categoria que `create-occurrence.ts` precisa para validar
 * `categoryId`: existência e se está ativa.
 */
export interface CategoryLookup {
  id: string;
  active: boolean;
}

/** Recorte de categoria devolvido pelo catálogo (`GET /api/v1/categories`). */
export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

/**
 * Port de leitura de categorias. A implementação real vive em
 * `infra/prisma-category-repository.ts`; os testes usam um fake em memória.
 */
export interface CategoryRepository {
  findById(id: string): Promise<CategoryLookup | null>;
  /** Categorias ativas, ordenadas por nome — catálogo usado por `list-categories.ts`. */
  listActive(): Promise<CategorySummary[]>;
}
