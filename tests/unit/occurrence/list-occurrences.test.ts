import { describe, expect, it } from 'vitest';

import {
  listOccurrences,
  listOccurrencesQuerySchema,
} from '@/modules/occurrence/application/list-occurrences';
import type { OccurrenceRecord } from '@/modules/occurrence/application/ports/occurrence-repository';
import type { Actor } from '@/modules/occurrence/domain/occurrence';

import { createInMemoryOccurrenceRepository } from '../../helpers/occurrence-repository';

const ana: Actor = { id: 'user-ana', role: 'SOLICITANTE' };
const bruno: Actor = { id: 'user-bruno', role: 'SOLICITANTE' };
const gestor: Actor = { id: 'user-gestor', role: 'GESTOR' };

function buildRecord(overrides: Partial<OccurrenceRecord> = {}): OccurrenceRecord {
  return {
    id: 'occ-default',
    code: 'OC-2026-000001',
    title: 'Título padrão',
    description: 'Descrição padrão',
    status: 'ABERTA',
    priority: 'MEDIA',
    categoryId: 'cat-1',
    locationLabel: 'Bloco A',
    latitude: null,
    longitude: null,
    imageUrl: null,
    imageKey: null,
    createdById: ana.id,
    assignedToId: null,
    resolutionNote: null,
    resolvedAt: null,
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
    updatedAt: new Date('2026-09-01T12:00:00.000Z'),
    ...overrides,
  };
}

const seed = [
  buildRecord({
    id: 'occ-ana-1',
    code: 'OC-2026-000001',
    title: 'Vazamento na garagem',
    description: 'Água acumulada perto da vaga 12',
    createdById: ana.id,
    status: 'ABERTA',
    priority: 'ALTA',
    categoryId: 'cat-hidraulica',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
  }),
  buildRecord({
    id: 'occ-ana-2',
    code: 'OC-2026-000002',
    title: 'Lâmpada queimada',
    description: 'Corredor do 5º andar sem luz',
    createdById: ana.id,
    status: 'RESOLVIDA',
    priority: 'BAIXA',
    categoryId: 'cat-eletrica',
    assignedToId: gestor.id,
    createdAt: new Date('2026-08-05T10:00:00.000Z'),
  }),
  buildRecord({
    id: 'occ-bruno-1',
    code: 'OC-2026-000003',
    title: 'Portão da garagem emperrado',
    description: 'Não fecha sozinho',
    createdById: bruno.id,
    status: 'EM_ANALISE',
    priority: 'MEDIA',
    categoryId: 'cat-seguranca',
    assignedToId: gestor.id,
    createdAt: new Date('2026-08-10T10:00:00.000Z'),
  }),
];

describe('listOccurrencesQuerySchema', () => {
  it('aplica os defaults de page/pageSize', () => {
    const parsed = listOccurrencesQuerySchema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it('faz coerção de page/pageSize vindos de query string (strings)', () => {
    const parsed = listOccurrencesQuerySchema.parse({ page: '2', pageSize: '10' });

    expect(parsed).toMatchObject({ page: 2, pageSize: 10 });
  });

  it('rejeita status fora do enum (ex.: BANANA)', () => {
    expect(listOccurrencesQuerySchema.safeParse({ status: 'BANANA' }).success).toBe(false);
  });

  it('rejeita page negativo ou zero', () => {
    expect(listOccurrencesQuerySchema.safeParse({ page: -1 }).success).toBe(false);
    expect(listOccurrencesQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejeita pageSize acima de 100', () => {
    expect(listOccurrencesQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});

describe('listOccurrences — escopo por perfil', () => {
  it('GESTOR vê todas as ocorrências', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(listOccurrencesQuerySchema.parse({}), gestor, {
      occurrences: repository,
    });

    expect(result.total).toBe(3);
    expect(result.data.map((o) => o.id).sort()).toEqual(['occ-ana-1', 'occ-ana-2', 'occ-bruno-1']);
  });

  it('SOLICITANTE só vê as próprias ocorrências', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(listOccurrencesQuerySchema.parse({}), ana, {
      occurrences: repository,
    });

    expect(result.total).toBe(2);
    expect(result.data.every((o) => o.createdById === ana.id)).toBe(true);
    expect(result.data.some((o) => o.id === 'occ-bruno-1')).toBe(false);
  });

  it('um SOLICITANTE não fura o recorte passando assignedToId de outra pessoa', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    // occ-bruno-1 tem assignedToId === gestor.id; ana tenta "burlar" o recorte
    // filtrando por esse assignedToId, mas o createdById continua sendo o
    // dela — o filtro é ANDado com o recorte, não substitui.
    const result = await listOccurrences(
      listOccurrencesQuerySchema.parse({ assignedToId: gestor.id }),
      ana,
      { occurrences: repository },
    );

    expect(result.total).toBe(1);
    expect(result.data[0]?.id).toBe('occ-ana-2');
    expect(result.data.some((o) => o.id === 'occ-bruno-1')).toBe(false);
  });

  it('um SOLICITANTE não vê a ocorrência de outro nem filtrando por categoria/status usados por ela', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(
      listOccurrencesQuerySchema.parse({ categoryId: 'cat-seguranca', status: 'EM_ANALISE' }),
      ana,
      { occurrences: repository },
    );

    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
  });
});

describe('listOccurrences — filtros', () => {
  it('filtra por status', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(
      listOccurrencesQuerySchema.parse({ status: 'RESOLVIDA' }),
      gestor,
      { occurrences: repository },
    );

    expect(result.data.map((o) => o.id)).toEqual(['occ-ana-2']);
  });

  it('filtra por categoryId', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(
      listOccurrencesQuerySchema.parse({ categoryId: 'cat-hidraulica' }),
      gestor,
      { occurrences: repository },
    );

    expect(result.data.map((o) => o.id)).toEqual(['occ-ana-1']);
  });

  it('filtra por priority', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(
      listOccurrencesQuerySchema.parse({ priority: 'BAIXA' }),
      gestor,
      { occurrences: repository },
    );

    expect(result.data.map((o) => o.id)).toEqual(['occ-ana-2']);
  });

  it('filtra por assignedToId', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(
      listOccurrencesQuerySchema.parse({ assignedToId: gestor.id }),
      gestor,
      { occurrences: repository },
    );

    expect(result.data.map((o) => o.id).sort()).toEqual(['occ-ana-2', 'occ-bruno-1']);
  });

  it('busca q em title/description/code, case-insensitive', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const porTitulo = await listOccurrences(
      listOccurrencesQuerySchema.parse({ q: 'GARAGEM' }),
      gestor,
      { occurrences: repository },
    );
    expect(porTitulo.data.map((o) => o.id).sort()).toEqual(['occ-ana-1', 'occ-bruno-1']);

    const porDescricao = await listOccurrences(
      listOccurrencesQuerySchema.parse({ q: 'quinto andar' }),
      gestor,
      { occurrences: repository },
    );
    expect(porDescricao.data).toEqual([]);

    const porCode = await listOccurrences(
      listOccurrencesQuerySchema.parse({ q: 'oc-2026-000003' }),
      gestor,
      { occurrences: repository },
    );
    expect(porCode.data.map((o) => o.id)).toEqual(['occ-bruno-1']);
  });

  it('ordena por createdAt desc por padrão', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(listOccurrencesQuerySchema.parse({}), gestor, {
      occurrences: repository,
    });

    expect(result.data.map((o) => o.id)).toEqual(['occ-bruno-1', 'occ-ana-2', 'occ-ana-1']);
  });
});

describe('listOccurrences — paginação', () => {
  it('devolve { data, page, pageSize, total }', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(
      listOccurrencesQuerySchema.parse({ page: 1, pageSize: 2 }),
      gestor,
      { occurrences: repository },
    );

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(2);
  });

  it('a segunda página traz o restante', async () => {
    const { repository } = createInMemoryOccurrenceRepository(seed);

    const result = await listOccurrences(
      listOccurrencesQuerySchema.parse({ page: 2, pageSize: 2 }),
      gestor,
      { occurrences: repository },
    );

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(3);
  });
});
