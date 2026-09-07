import Link from 'next/link';
import { Suspense } from 'react';

import { PriorityBadge } from '@/components/occurrences/priority-badge';
import { StatusBadge } from '@/components/occurrences/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { requireSessionOrRedirect } from '@/core/http/auth-guards';
import { formatDate } from '@/lib/occurrences/date';
import {
  buildOccurrencesHref,
  hasActiveFilters,
  readOccurrenceFilters,
} from '@/lib/occurrences/query';
import { listCategories } from '@/modules/occurrence/application/list-categories';
import {
  listOccurrences,
  listOccurrencesQuerySchema,
} from '@/modules/occurrence/application/list-occurrences';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { prismaCategoryRepository } from '@/modules/occurrence/infra/prisma-category-repository';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

import { OccurrenceFilters } from './occurrence-filters';

export const metadata = {
  title: 'Ocorrências · Resolve Aí',
};

interface OcorrenciasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Server Component. O cabeçalho (título, saudação, botão "Nova ocorrência")
 * não depende de dados além da sessão e renderiza de imediato; a parte que
 * consulta o banco (`listOccurrences`/`listCategories`) mora em
 * `OcorrenciasListContent`, isolada num `<Suspense>` próprio desta página —
 * **não** em `loading.tsx` de segmento.
 *
 * Motivo: um `loading.tsx` neste segmento cria um
 * boundary de streaming sobre toda a subárvore de `ocorrencias/`, incluindo
 * `ocorrencias/[id]`. Isso fazia o shell da rota de detalhe ser enviado com
 * `200` antes de o React resolver a árvore até `notFound()` — o `<h1>` de
 * "não encontrado" só existia no payload de hidratação, nunca no HTML cru,
 * e o status HTTP nunca virava 404 de verdade. Um `<Suspense>` declarado
 * aqui dentro, em vez de um arquivo especial de segmento, fica contido a
 * esta página — `ocorrencias/[id]/page.tsx` volta a renderizar sem streaming
 * por cima, então `notFound()` decide o HTML e o status antes de qualquer
 * byte sair.
 */
export default async function OcorrenciasPage({ searchParams }: OcorrenciasPageProps) {
  const session = await requireSessionOrRedirect();
  const actor: Actor = { id: session.user.id, role: session.user.role };

  const rawSearchParams = await searchParams;
  const filters = readOccurrenceFilters(rawSearchParams);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ocorrências</h1>
          <p className="text-muted-foreground text-sm">
            Olá, {session.user.name}. Aqui você acompanha seus registros.
          </p>
        </div>
        <Button asChild>
          <Link href="/ocorrencias/nova">Nova ocorrência</Link>
        </Button>
      </div>

      <Suspense fallback={<OcorrenciasListSkeleton />}>
        <OcorrenciasListContent actor={actor} filters={filters} />
      </Suspense>
    </section>
  );
}

function OcorrenciasListSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

interface OcorrenciasListContentProps {
  actor: Actor;
  filters: Record<string, string>;
}

/**
 * Filtros, lista/paginação e os dois estados vazios — tudo que depende do
 * banco. Componente `async` separado só para poder ficar dentro do
 * `<Suspense>` do componente pai sem bloquear o cabeçalho.
 */
async function OcorrenciasListContent({ actor, filters }: OcorrenciasListContentProps) {
  // Reusa o schema do use-case para validar a query string — uma URL com
  // filtro inválido (editada à mão) cai de volta para a primeira página sem
  // filtro em vez de estourar um 500.
  const parsedQuery = listOccurrencesQuerySchema.safeParse(filters);
  const query = parsedQuery.success ? parsedQuery.data : listOccurrencesQuerySchema.parse({});

  // `listCategories` continua sendo buscado aqui, mas só para popular o
  // `<Select>` de filtro (categorias ativas e selecionáveis) — o nome exibido
  // em cada item da lista vem de `occurrence.categoryName`, resolvido por
  // join no repositório, não deste catálogo.
  const [result, categories] = await Promise.all([
    listOccurrences(query, actor, { occurrences: prismaOccurrenceRepository }),
    listCategories({ categories: prismaCategoryRepository }),
  ]);

  const filtersActive = hasActiveFilters(filters);
  const isEmpty = result.data.length === 0;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <>
      <OccurrenceFilters filters={filters} categories={categories} />

      {isEmpty ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {filtersActive ? 'Nenhuma ocorrência encontrada' : 'Nenhuma ocorrência ainda'}
            </CardTitle>
            <CardDescription>
              {filtersActive
                ? 'Nenhum registro corresponde aos filtros aplicados. Tente outro status, categoria ou termo de busca.'
                : 'Suas ocorrências aparecerão aqui assim que forem registradas.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filtersActive ? (
              <Button variant="outline" asChild>
                <Link href="/ocorrencias">Limpar filtros</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/ocorrencias/nova">Criar minha primeira ocorrência</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="space-y-3">
            {result.data.map((occurrence) => (
              <li key={occurrence.id}>
                <Link
                  href={`/ocorrencias/${occurrence.id}`}
                  className="hover:border-ring focus-visible:ring-ring/50 block rounded-lg border p-4 transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-muted-foreground font-mono text-xs">{occurrence.code}</p>
                      <p className="truncate font-medium">{occurrence.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {occurrence.categoryName} · {formatDate(occurrence.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <StatusBadge status={occurrence.status} />
                      <PriorityBadge priority={occurrence.priority} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <nav className="flex items-center justify-between" aria-label="Paginação">
            {query.page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildOccurrencesHref(filters, { page: query.page - 1 })}>Anterior</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
            )}

            <p className="text-muted-foreground text-sm">
              Página {query.page} de {totalPages}
            </p>

            {query.page < totalPages ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildOccurrencesHref(filters, { page: query.page + 1 })}>Próxima</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Próxima
              </Button>
            )}
          </nav>
        </>
      )}
    </>
  );
}
