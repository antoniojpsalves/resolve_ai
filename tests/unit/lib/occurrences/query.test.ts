import { describe, expect, it } from 'vitest';

import {
  buildOccurrencesHref,
  firstValue,
  hasActiveFilters,
  parseOccurrenceFilters,
  readOccurrenceFilters,
} from '@/lib/occurrences/query';

describe('firstValue', () => {
  it('devolve o valor quando é uma string', () => {
    expect(firstValue('ABERTA')).toBe('ABERTA');
  });

  it('devolve o primeiro item quando é um array', () => {
    expect(firstValue(['ABERTA', 'CANCELADA'])).toBe('ABERTA');
  });

  it('devolve undefined quando o valor é undefined', () => {
    expect(firstValue(undefined)).toBeUndefined();
  });
});

describe('readOccurrenceFilters', () => {
  it('descarta chaves ausentes ou vazias', () => {
    const filters = readOccurrenceFilters({ status: 'ABERTA', q: '', categoryId: undefined });

    expect(filters).toEqual({ status: 'ABERTA' });
  });

  it('achata valores repetidos (array) para o primeiro', () => {
    const filters = readOccurrenceFilters({ status: ['ABERTA', 'CANCELADA'] });

    expect(filters).toEqual({ status: 'ABERTA' });
  });

  it('sem nenhum filtro devolve objeto vazio', () => {
    expect(readOccurrenceFilters({})).toEqual({});
  });
});

describe('hasActiveFilters', () => {
  it('false quando só há page/pageSize', () => {
    expect(hasActiveFilters({ page: '2', pageSize: '20' })).toBe(false);
  });

  it('false para filtros vazios', () => {
    expect(hasActiveFilters({})).toBe(false);
  });

  it('true quando há status, categoria ou busca', () => {
    expect(hasActiveFilters({ status: 'ABERTA' })).toBe(true);
    expect(hasActiveFilters({ categoryId: 'cat-1' })).toBe(true);
    expect(hasActiveFilters({ q: 'vazamento' })).toBe(true);
  });
});

describe('parseOccurrenceFilters', () => {
  // Reproduz ao vivo em `/ocorrencias?status=RESOLVIDA&pageSize=9999`: o
  // `safeParse` do objeto inteiro falhava por causa só do `pageSize` (acima
  // do máximo de 100) e derrubava também o `status`, válido. `applied` é o
  // que a UI usa para refletir o filtro que está de fato em vigor.
  it('um campo inválido descarta só aquele campo, preservando os demais', () => {
    const { query, applied } = parseOccurrenceFilters({
      status: 'RESOLVIDA',
      pageSize: '9999',
    });

    expect(query.status).toBe('RESOLVIDA');
    expect(query.pageSize).toBe(20); // volta ao default, não ao valor inválido
    expect(applied).toEqual({ status: 'RESOLVIDA' });
  });

  it('todos os campos válidos ficam aplicados', () => {
    const { query, applied } = parseOccurrenceFilters({
      status: 'RESOLVIDA',
      categoryId: 'cat-1',
      q: 'vazamento',
      page: '2',
      pageSize: '10',
    });

    expect(query).toMatchObject({
      status: 'RESOLVIDA',
      categoryId: 'cat-1',
      q: 'vazamento',
      page: 2,
      pageSize: 10,
    });
    expect(applied).toEqual({
      status: 'RESOLVIDA',
      categoryId: 'cat-1',
      q: 'vazamento',
      page: '2',
      pageSize: '10',
    });
  });

  it('campo desconhecido é ignorado, sem afetar os demais', () => {
    const { query, applied } = parseOccurrenceFilters({
      status: 'ABERTA',
      campoInventado: 'x',
    });

    expect(query.status).toBe('ABERTA');
    expect(applied).toEqual({ status: 'ABERTA' });
  });

  it('nenhum filtro válido devolve a listagem sem filtro (defaults do schema)', () => {
    const { query, applied } = parseOccurrenceFilters({ status: 'BANANA', pageSize: '-1' });

    expect(query).toMatchObject({ page: 1, pageSize: 20 });
    expect(query.status).toBeUndefined();
    expect(applied).toEqual({});
  });
});

describe('buildOccurrencesHref', () => {
  it('sem filtro nenhum, devolve só o caminho', () => {
    expect(buildOccurrencesHref({})).toBe('/ocorrencias');
  });

  it('preserva os filtros atuais na query string', () => {
    const href = buildOccurrencesHref({ status: 'ABERTA', q: 'poste' });
    const params = new URLSearchParams(href.split('?')[1]);

    expect(params.get('status')).toBe('ABERTA');
    expect(params.get('q')).toBe('poste');
  });

  it('override troca um filtro sem afetar os demais', () => {
    const href = buildOccurrencesHref({ status: 'ABERTA', q: 'poste' }, { status: 'RESOLVIDA' });
    const params = new URLSearchParams(href.split('?')[1]);

    expect(params.get('status')).toBe('RESOLVIDA');
    expect(params.get('q')).toBe('poste');
  });

  it('override com null remove a chave (ex.: limpar um filtro)', () => {
    const href = buildOccurrencesHref({ status: 'ABERTA', q: 'poste' }, { status: null });
    const params = new URLSearchParams(href.split('?')[1]);

    expect(params.has('status')).toBe(false);
    expect(params.get('q')).toBe('poste');
  });

  it('page igual ao padrão (1) some da URL', () => {
    const href = buildOccurrencesHref({ status: 'ABERTA' }, { page: 1 });
    const params = new URLSearchParams(href.split('?')[1]);

    expect(params.has('page')).toBe(false);
  });

  it('page diferente do padrão aparece na URL', () => {
    const href = buildOccurrencesHref({ status: 'ABERTA' }, { page: 3 });
    const params = new URLSearchParams(href.split('?')[1]);

    expect(params.get('page')).toBe('3');
  });
});
