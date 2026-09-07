import type { z } from 'zod';

import {
  listOccurrencesQuerySchema,
  type ListOccurrencesQueryInput,
} from '@/modules/occurrence/application/list-occurrences';

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
 * Resultado de validar os filtros da URL: `query` é o que `listOccurrences`
 * recebe (já com defaults de `page`/`pageSize` aplicados); `applied` é o
 * subconjunto de `filters` que passou na validação campo a campo — a UI usa
 * `applied`, nunca `filters`, para refletir o que está de fato em vigor
 * (`Select` marcado, "Limpar filtros" visível, link de paginação).
 */
export interface ParsedOccurrenceFilters {
  query: ListOccurrencesQueryInput;
  applied: Record<string, string>;
}

/**
 * Valida os filtros da URL campo a campo, contra o mesmo schema Zod do
 * use-case (`listOccurrencesQuerySchema`) — mas sem o atalho de
 * `safeParse` do objeto inteiro seguido de `parse({})` no erro, que descarta
 * TODOS os filtros quando só um é inválido. Reproduzido ao vivo:
 * `/ocorrencias?status=RESOLVIDA&pageSize=9999` devolvia as 13 ocorrências
 * (todas, sem filtro de status) porque o `pageSize` fora do intervalo
 * derrubava o parse inteiro, mas o `Select` continuava marcado "Resolvida" —
 * a UI usava os filtros crus, não os efetivamente aplicados.
 *
 * Um campo inválido é simplesmente omitido antes do parse final — cai no
 * valor default do schema quando existe (`page`, `pageSize`) ou fica ausente
 * (os demais), exatamente como se o usuário nunca o tivesse informado.
 */
export function parseOccurrenceFilters(filters: Record<string, string>): ParsedOccurrenceFilters {
  const shape = listOccurrencesQuerySchema.shape;
  const applied: Record<string, string> = {};

  for (const [key, value] of Object.entries(filters)) {
    const fieldSchema: z.ZodTypeAny | undefined = shape[key as keyof typeof shape];

    if (fieldSchema?.safeParse(value).success) {
      applied[key] = value;
    }
  }

  return { query: listOccurrencesQuerySchema.parse(applied), applied };
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
