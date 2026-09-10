import { Star } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { PriorityBadge } from '@/components/occurrences/priority-badge';
import { StatusBadge } from '@/components/occurrences/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireRoleOrRedirect } from '@/core/http/auth-guards';
import { formatDate } from '@/lib/occurrences/date';
import {
  dashboardMetricsQuerySchema,
  getDashboardMetrics,
} from '@/modules/occurrence/application/get-dashboard-metrics';
import { listOccurrences } from '@/modules/occurrence/application/list-occurrences';
import type { ListOccurrencesQueryInput } from '@/modules/occurrence/application/list-occurrences';
import type { DashboardMetrics } from '@/modules/occurrence/application/ports/dashboard-repository';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { isTerminalStatus } from '@/modules/occurrence/domain/status';
import { prismaDashboardRepository } from '@/modules/occurrence/infra/prisma-dashboard-repository';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

import { CategoryChart } from './category-chart';
import { StatusChart } from './status-chart';
import { TimeSeriesChart } from './time-series-chart';

export const metadata = {
  title: 'Dashboard · Resolve Aí',
};

/**
 * Consulta usada para montar a lista de "ocorrências críticas": sem endpoint
 * dedicado, reusa `listOccurrences` já existente,
 * ordenado por prioridade desc (a implementação Prisma usa a ordem nativa do
 * enum `Priority`, então `desc` traz `URGENTE` primeiro — ver comentário em
 * `list-occurrences.ts`). Sem filtro de `status`: a query não suporta múltiplos
 * valores, então o filtro de status terminal é feito aqui, no servidor, depois
 * da busca.
 */
const CRITICAL_OCCURRENCES_QUERY: ListOccurrencesQueryInput = {
  page: 1,
  pageSize: 20,
  sortBy: 'priority',
  sortOrder: 'desc',
};

const CRITICAL_OCCURRENCES_LIMIT = 5;

/**
 * Tela restrita a GESTOR — a prova do RBAC ponta a ponta.
 *
 * A decisão é tomada no servidor pela guarda `requireRoleOrRedirect`, não por
 * um `if` de UI: um SOLICITANTE que digite a URL na barra de endereços é
 * mandado de volta para `/ocorrencias`.
 *
 * Cabeçalho fora do `Suspense` (não depende do banco); `DashboardContent` —
 * KPIs, gráficos, críticas e responsáveis — mora num componente `async`
 * isolado dentro de um `<Suspense>` próprio desta página, mesmo padrão de
 * `ocorrencias/page.tsx` (não `loading.tsx` de segmento).
 */
export default async function DashboardPage() {
  const session = await requireRoleOrRedirect('GESTOR');
  const actor: Actor = { id: session.user.id, role: session.user.role };

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Visão gerencial — acesso restrito a gestores.
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent actor={actor} />
      </Suspense>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

interface DashboardContentProps {
  actor: Actor;
}

async function DashboardContent({ actor }: DashboardContentProps) {
  const [metrics, criticalResult] = await Promise.all([
    getDashboardMetrics(dashboardMetricsQuerySchema.parse({}), {
      dashboard: prismaDashboardRepository,
    }),
    listOccurrences(CRITICAL_OCCURRENCES_QUERY, actor, {
      occurrences: prismaOccurrenceRepository,
    }),
  ]);

  // Filtro de status terminal aplicado aqui, no servidor, antes de renderizar
  // — a query de `listOccurrences` não suporta múltiplos status, então
  // "prioridade alta, ainda em aberto" não dá para expressar como filtro de
  // busca. `RESOLVIDA`/`CANCELADA` (ver `isTerminalStatus`, `domain/status.ts`)
  // saem antes de cortar para as 5 primeiras.
  const criticalOccurrences = criticalResult.data
    .filter((occurrence) => !isTerminalStatus(occurrence.status))
    .slice(0, CRITICAL_OCCURRENCES_LIMIT);

  return (
    <div className="space-y-6">
      <KpiCards metrics={metrics} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ocorrências por status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusChart data={metrics.totalByStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ocorrências por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryChart data={metrics.totalByCategory} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Abertas × resolvidas (últimos 30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeSeriesChart data={metrics.timeSeries} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <CriticalOccurrencesCard occurrences={criticalOccurrences} />
        <TopResponsiblesCard topResponsibles={metrics.topResponsibles} />
      </div>
    </div>
  );
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** `"18h"` para menos de 48h, `"N,N dias"` acima disso — mais legível para
 * durações longas do que uma contagem de horas de 3+ dígitos. */
function formatResolutionHours(hours: number): string {
  if (hours < 48) {
    return `${Math.round(hours)}h`;
  }

  return `${(hours / 24).toFixed(1).replace('.', ',')} dias`;
}

function KpiCards({ metrics }: { metrics: DashboardMetrics }) {
  const totalOccurrences = metrics.totalByStatus.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Total de ocorrências</CardDescription>
          <CardTitle className="text-3xl">{totalOccurrences}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Em atraso</CardDescription>
          <CardTitle className="text-3xl">{metrics.overdueCount}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          {metrics.overdueCount}{' '}
          {pluralize(metrics.overdueCount, 'ocorrência aberta', 'ocorrências abertas')} há mais de{' '}
          {metrics.overdueDays} {pluralize(metrics.overdueDays, 'dia', 'dias')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Tempo médio de resolução</CardDescription>
          {metrics.averageResolutionHours === null ? (
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Sem ocorrências resolvidas ainda
            </CardTitle>
          ) : (
            <CardTitle className="text-3xl">
              {formatResolutionHours(metrics.averageResolutionHours)}
            </CardTitle>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Nota média</CardDescription>
          {metrics.averageRating === null ? (
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Sem avaliações ainda
            </CardTitle>
          ) : (
            <CardTitle className="flex items-center gap-2 text-3xl">
              {metrics.averageRating.toFixed(1).replace('.', ',')}
              <span className="flex" aria-hidden>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star
                    key={value}
                    className={
                      value <= Math.round(metrics.averageRating!)
                        ? 'size-4 fill-amber-400 text-amber-400'
                        : 'text-muted-foreground size-4'
                    }
                  />
                ))}
              </span>
            </CardTitle>
          )}
        </CardHeader>
      </Card>
    </div>
  );
}

type CriticalOccurrence = Awaited<ReturnType<typeof listOccurrences>>['data'][number];

function CriticalOccurrencesCard({ occurrences }: { occurrences: CriticalOccurrence[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ocorrências críticas</CardTitle>
        <CardDescription>Prioridade mais alta, ainda não finalizadas.</CardDescription>
      </CardHeader>
      <CardContent>
        {occurrences.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma ocorrência crítica no momento.</p>
        ) : (
          <ul className="space-y-2">
            {occurrences.map((occurrence) => (
              <li key={occurrence.id}>
                <Link
                  href={`/ocorrencias/${occurrence.id}`}
                  className="hover:border-ring focus-visible:ring-ring/50 block rounded-lg border p-3 transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-muted-foreground font-mono text-xs">{occurrence.code}</p>
                      <p className="truncate text-sm font-medium">{occurrence.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(occurrence.createdAt)}
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
        )}
      </CardContent>
    </Card>
  );
}

function TopResponsiblesCard({
  topResponsibles,
}: {
  topResponsibles: DashboardMetrics['topResponsibles'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top responsáveis</CardTitle>
        <CardDescription>Ocorrências atribuídas, por responsável.</CardDescription>
      </CardHeader>
      <CardContent>
        {topResponsibles.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma ocorrência com responsável atribuído ainda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ocorrências</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topResponsibles.map((responsible) => (
                <TableRow key={responsible.userId}>
                  <TableCell>{responsible.userName}</TableCell>
                  <TableCell className="text-right">{responsible.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
