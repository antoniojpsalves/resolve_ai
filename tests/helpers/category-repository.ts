import type {
  CategoryLookup,
  CategoryRepository,
  CategorySummary,
} from '@/modules/occurrence/application/ports/category-repository';

/**
 * Seed do fake: `name`/`slug` são opcionais (default = o próprio `id`) porque
 * a maioria dos testes existentes (`create-occurrence`) só precisa de
 * `id`/`active` — só o teste de `list-categories` precisa de nomes de
 * verdade para checar a ordenação.
 */
export type FakeCategorySeed = CategoryLookup & Partial<Pick<CategorySummary, 'name' | 'slug'>>;

/**
 * Repositório fake em memória de `CategoryRepository`, usado pelos testes de
 * `create-occurrence` (existência/`active` de `categoryId`) e de
 * `list-categories` (catálogo de categorias ativas) sem tocar o Prisma.
 */
export function createInMemoryCategoryRepository(seed: FakeCategorySeed[] = []) {
  const rows = new Map<string, CategorySummary & CategoryLookup>(
    seed.map((category) => [
      category.id,
      {
        id: category.id,
        active: category.active,
        name: category.name ?? category.id,
        slug: category.slug ?? category.id,
      },
    ]),
  );

  const repository: CategoryRepository = {
    async findById(id: string) {
      const row = rows.get(id);

      return row ? { id: row.id, active: row.active } : null;
    },

    async listActive() {
      return [...rows.values()]
        .filter((row) => row.active)
        .map(({ id, name, slug }) => ({ id, name, slug }));
    },
  };

  return { repository, rows };
}
