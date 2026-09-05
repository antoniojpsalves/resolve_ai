import { prisma } from '@/core/db/prisma';

import type {
  CategoryLookup,
  CategoryRepository,
  CategorySummary,
} from '../application/ports/category-repository';

/**
 * Implementação Prisma da port `CategoryRepository`: a checagem que
 * `create-occurrence.ts` precisa (existência + `active`) e o catálogo de
 * `list-categories.ts` (categorias ativas, ordenadas por nome).
 */
export const prismaCategoryRepository: CategoryRepository = {
  async findById(id: string): Promise<CategoryLookup | null> {
    const row = await prisma.category.findUnique({
      where: { id },
      select: { id: true, active: true },
    });

    return row;
  },

  async listActive(): Promise<CategorySummary[]> {
    return prisma.category.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  },
};
