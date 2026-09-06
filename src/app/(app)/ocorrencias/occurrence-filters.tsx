'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildOccurrencesHref, hasActiveFilters } from '@/lib/occurrences/query';
import { ALL_STATUSES, statusLabel } from '@/lib/occurrences/status';
import type { CategorySummary } from '@/modules/occurrence/application/ports/category-repository';

/** Sentinela para "sem filtro" nos `Select` — Radix não aceita `value=""` num item. */
const ANY_VALUE = 'TODAS';

interface OccurrenceFiltersProps {
  filters: Record<string, string>;
  categories: CategorySummary[];
}

/**
 * Filtros por status, categoria e busca por texto — sempre refletidos na URL
 * (query string), nunca só em estado local: link compartilhável e o botão
 * voltar do navegador funcionam (item do brief). Cada mudança de `Select`
 * navega direto; a busca por texto só navega ao enviar o formulário, para não
 * disparar uma navegação a cada tecla digitada.
 */
export function OccurrenceFilters({ filters, categories }: OccurrenceFiltersProps) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q ?? '');

  function go(overrides: Record<string, string | null>) {
    router.push(buildOccurrencesHref(filters, { ...overrides, page: null }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go({ q: q.trim() || null });
  }

  function clearFilters() {
    setQ('');
    router.push('/ocorrencias');
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Filtrar ocorrências"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select
          value={filters.status ?? ANY_VALUE}
          onValueChange={(value) => go({ status: value === ANY_VALUE ? null : value })}
        >
          <SelectTrigger id="filter-status" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todos os status</SelectItem>
            {ALL_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="filter-category">Categoria</Label>
        <Select
          value={filters.categoryId ?? ANY_VALUE}
          onValueChange={(value) => go({ categoryId: value === ANY_VALUE ? null : value })}
        >
          <SelectTrigger id="filter-category" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todas as categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="filter-q">Buscar</Label>
        <Input
          id="filter-q"
          placeholder="Título, descrição ou protocolo"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit">Buscar</Button>
        {hasActiveFilters(filters) ? (
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Limpar filtros
          </Button>
        ) : null}
      </div>
    </form>
  );
}
