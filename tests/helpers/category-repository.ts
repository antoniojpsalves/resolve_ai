import type {
  CategoryLookup,
  CategoryRepository,
} from '@/modules/occurrence/application/ports/category-repository';

/**
 * Repositório fake em memória de `CategoryRepository`, usado pelo teste de
 * `create-occurrence` para simular categoria existente/inexistente/inativa
 * sem tocar o Prisma.
 */
export function createInMemoryCategoryRepository(seed: CategoryLookup[] = []) {
  const rows = new Map<string, CategoryLookup>(seed.map((category) => [category.id, category]));

  const repository: CategoryRepository = {
    async findById(id: string) {
      return rows.get(id) ?? null;
    },
  };

  return { repository, rows };
}
