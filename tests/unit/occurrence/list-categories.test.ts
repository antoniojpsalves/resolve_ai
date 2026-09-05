import { describe, expect, it } from 'vitest';

import { listCategories } from '@/modules/occurrence/application/list-categories';

import { createInMemoryCategoryRepository } from '../../helpers/category-repository';

describe('listCategories', () => {
  it('devolve só as categorias ativas', async () => {
    const { repository } = createInMemoryCategoryRepository([
      { id: 'cat-1', active: true, name: 'Iluminação' },
      { id: 'cat-2', active: false, name: 'Categoria desativada' },
      { id: 'cat-3', active: true, name: 'Hidráulica' },
    ]);

    const result = await listCategories({ categories: repository });

    expect(result.map((c) => c.id)).toEqual(['cat-3', 'cat-1']);
  });

  it('ordena por nome, independentemente da ordem devolvida pelo repositório', async () => {
    const { repository } = createInMemoryCategoryRepository([
      { id: 'cat-z', active: true, name: 'Zeladoria' },
      { id: 'cat-a', active: true, name: 'Árvores e podas' },
      { id: 'cat-m', active: true, name: 'Manutenção viária' },
    ]);

    const result = await listCategories({ categories: repository });

    expect(result.map((c) => c.name)).toEqual([
      'Árvores e podas',
      'Manutenção viária',
      'Zeladoria',
    ]);
  });

  it('devolve lista vazia quando não há categoria ativa', async () => {
    const { repository } = createInMemoryCategoryRepository([
      { id: 'cat-1', active: false, name: 'Inativa' },
    ]);

    const result = await listCategories({ categories: repository });

    expect(result).toEqual([]);
  });

  it('devolve id/name/slug de cada categoria', async () => {
    const { repository } = createInMemoryCategoryRepository([
      { id: 'cat-1', active: true, name: 'Iluminação', slug: 'iluminacao' },
    ]);

    const result = await listCategories({ categories: repository });

    expect(result).toEqual([{ id: 'cat-1', name: 'Iluminação', slug: 'iluminacao' }]);
  });
});
