/**
 * Recorte mínimo de categoria que `create-occurrence.ts` precisa para validar
 * `categoryId`: existência e se está ativa. O CRUD completo de categorias
 * (`GET /categories`) é da Tarefa 3 — esta port só cobre a checagem que a
 * criação de ocorrência já precisa hoje.
 */
export interface CategoryLookup {
  id: string;
  active: boolean;
}

/**
 * Port de leitura de categorias. A implementação real vive em
 * `infra/prisma-category-repository.ts`; os testes usam um fake em memória.
 */
export interface CategoryRepository {
  findById(id: string): Promise<CategoryLookup | null>;
}
