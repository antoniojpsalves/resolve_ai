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
import { ALL_PRIORITIES, priorityLabel } from '@/lib/occurrences/priority';
import { ALL_STATUSES, statusLabel } from '@/lib/occurrences/status';
import type { CategorySummary } from '@/modules/occurrence/application/ports/category-repository';

/** Sentinela para "sem filtro" nos `Select` — Radix não aceita `value=""` num item. */
const ANY_VALUE = 'TODAS';

interface OccurrenceFiltersProps {
  filters: Record<string, string>;
  categories: CategorySummary[];
  /** Só passado quando `actor.role === 'GESTOR'` — solicitante não filtra por responsável (não faz sentido para quem só vê as próprias ocorrências). */
  managers?: { id: string; name: string }[];
}

/** Rótulo da direção de ordenação — "recentes/antigos" só faz sentido para `createdAt`; os demais `sortBy` usam crescente/decrescente. */
function sortOrderLabels(sortBy: string): { asc: string; desc: string } {
  if (sortBy === 'createdAt') {
    return { desc: 'Mais recentes primeiro', asc: 'Mais antigos primeiro' };
  }

  return { asc: 'Crescente', desc: 'Decrescente' };
}

/**
 * Filtros por status, categoria, prioridade e busca por texto — sempre
 * refletidos na URL (query string), nunca só em estado local: link
 * compartilhável e o botão voltar do navegador funcionam. Cada mudança de
 * `Select` navega direto; a busca por texto só navega ao enviar o
 * formulário, para não disparar uma navegação a cada tecla digitada.
 */
export function OccurrenceFilters({ filters, categories, managers }: OccurrenceFiltersProps) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q ?? '');
  const sortBy = filters.sortBy ?? 'createdAt';
  const orderLabels = sortOrderLabels(sortBy);

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

      <div className="grid gap-1.5">
        <Label htmlFor="filter-priority">Prioridade</Label>
        <Select
          value={filters.priority ?? ANY_VALUE}
          onValueChange={(value) => go({ priority: value === ANY_VALUE ? null : value })}
        >
          <SelectTrigger id="filter-priority" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todas as prioridades</SelectItem>
            {ALL_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priorityLabel(priority)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="filter-sort-by">Ordenar por</Label>
        <Select value={sortBy} onValueChange={(value) => go({ sortBy: value })}>
          <SelectTrigger id="filter-sort-by" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Data de abertura</SelectItem>
            <SelectItem value="priority">Prioridade</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="filter-sort-order">Direção</Label>
        <Select
          value={filters.sortOrder ?? 'desc'}
          onValueChange={(value) => go({ sortOrder: value })}
        >
          <SelectTrigger id="filter-sort-order" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">{orderLabels.desc}</SelectItem>
            <SelectItem value="asc">{orderLabels.asc}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {managers ? (
        <div className="grid gap-1.5">
          <Label htmlFor="filter-assigned">Responsável</Label>
          <Select
            value={filters.assignedToId ?? ANY_VALUE}
            onValueChange={(value) => go({ assignedToId: value === ANY_VALUE ? null : value })}
          >
            <SelectTrigger id="filter-assigned" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_VALUE}>Todos os responsáveis</SelectItem>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

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
