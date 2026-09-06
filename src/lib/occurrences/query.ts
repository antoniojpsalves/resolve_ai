/** O `page` que some da URL (fica implícito) quando o link volta ao padrão. */
const DEFAULT_PAGE = 1;

/** Filtros que não contam como "filtro ativo" para a distinção de estado vazio. */
const NON_FILTER_KEYS = new Set(['page', 'pageSize']);

/** `searchParams` do Next pode repetir uma chave (`?status=A&status=B`); ficamos com o primeiro valor. */
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Normaliza `searchParams` do Next (`Record<string, string | string[] | undefined>`)
 * para `Record<string, string>`, descartando entradas ausentes ou vazias.
 * Não valida os valores — quem valida de verdade é `listOccurrencesQuerySchema`
 * (reuso do use-case), esta função só arruma o formato de entrada.
 */
export function readOccurrenceFilters(
  searchParams: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(searchParams)) {
    const value = firstValue(rawValue);

    if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }

  return result;
}

/** `true` quando há algum filtro de conteúdo ativo (não conta `page`/`pageSize`). */
export function hasActiveFilters(filters: Record<string, string>): boolean {
  return Object.keys(filters).some((key) => !NON_FILTER_KEYS.has(key));
}

/**
 * Monta a query string (com o caminho) da listagem de ocorrências a partir
 * dos filtros atuais mais alterações pontuais (`overrides`) — usada tanto
 * pelos controles de filtro quanto pela paginação, sempre preservando os
 * demais parâmetros da URL. Um valor `null` em `overrides` remove a chave
 * (ex.: "Limpar categoria"); `page` some da URL quando volta ao padrão (1),
 * para manter o link mais enxuto.
 */
export function buildOccurrencesHref(
  current: Record<string, string>,
  overrides: Record<string, string | number | null | undefined> = {},
): string {
  const merged: Record<string, string | number | null | undefined> = { ...current, ...overrides };
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    if (key === 'page' && Number(value) === DEFAULT_PAGE) {
      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();

  return query ? `/ocorrencias?${query}` : '/ocorrencias';
}
