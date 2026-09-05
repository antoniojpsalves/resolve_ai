import { prisma } from '@/core/db/prisma';

import type { CategoryLookup, CategoryRepository } from '../application/ports/category-repository';

/**
 * Implementação Prisma da port `CategoryRepository`. Cobre só a checagem que
 * `create-occurrence.ts` precisa (existência + `active`) — o CRUD completo
 * de categorias é da Tarefa 3.
 */
export const prismaCategoryRepository: CategoryRepository = {
  async findById(id: string): Promise<CategoryLookup | null> {
    const row = await prisma.category.findUnique({
      where: { id },
      select: { id: true, active: true },
    });

    return row;
  },
};
