import { prisma } from '@/core/db/prisma';
import { ALL_PRIORITIES } from '@/modules/occurrence/domain/priority';
import { ALL_STATUSES } from '@/modules/occurrence/domain/status';

import type {
  CategoryCount,
  DashboardMetrics,
  DashboardRepository,
  PriorityCount,
  ResponsibleCount,
  StatusCount,
  TimeSeriesPoint,
} from '../application/ports/dashboard-repository';

const TOP_RESPONSIBLES_LIMIT = 5;
const TIME_SERIES_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function totalByStatus(): Promise<StatusCount[]> {
  const rows = await prisma.occurrence.groupBy({ by: ['status'], _count: true });
  const counts = new Map(rows.map((r) => [r.status, r._count]));

  // Preenche todas as chaves de `ALL_STATUSES`, mesmo as com `count: 0` — um
  // status sem nenhuma ocorrência não deveria simplesmente sumir da lista (o
  // gráfico da Tarefa 2 espera todas as chaves presentes).
  return ALL_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

async function totalByPriority(): Promise<PriorityCount[]> {
  const rows = await prisma.occurrence.groupBy({ by: ['priority'], _count: true });
  const counts = new Map(rows.map((r) => [r.priority, r._count]));

  return ALL_PRIORITIES.map((priority) => ({ priority, count: counts.get(priority) ?? 0 }));
}

async function totalByCategory(): Promise<CategoryCount[]> {
  const rows = await prisma.occurrence.groupBy({ by: ['categoryId'], _count: true });

  if (rows.length === 0) {
    return [];
  }

  // Segunda consulta para resolver `categoryName`: mesmo cuidado de
  // `prisma-occurrence-repository.ts` — busca todas as categorias
  // referenciadas independentemente de `active`, para que uma categoria
  // desativada depois de uma ocorrência antiga continue aparecendo com o
  // nome histórico, nunca "some" da lista.
  const categories = await prisma.category.findMany({
    where: { id: { in: rows.map((r) => r.categoryId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: nameById.get(r.categoryId) ?? r.categoryId,
    count: r._count,
  }));
}

async function overdueCount(now: Date, overdueDays: number): Promise<number> {
  const threshold = new Date(now.getTime() - overdueDays * MS_PER_DAY);

  return prisma.occurrence.count({
    where: {
      status: { notIn: ['RESOLVIDA', 'CANCELADA'] },
      createdAt: { lt: threshold },
    },
  });
}

/**
 * O tipo real de `avg_hours` foi checado contra o Postgres de teste (não
 * assumido): `AVG(EXTRACT(EPOCH FROM ...) / 3600)` chega como um objeto
 * `Prisma.Decimal` (`typeof === 'object'`, não `'string'` nem `'number'`) —
 * `null` quando não há linha `RESOLVIDA`. O detalhe perigoso: `Decimal` tem
 * `toJSON()` que devolve **string** (`"10"`), então devolver o objeto sem
 * converter faria `Response.json()` serializar `averageResolutionHours` como
 * string, violando o contrato `number | null` da porta sem que o TypeScript
 * acuse nada (o campo já está tipado `number` na interface, mas nada aqui
 * verificava o tipo em runtime). `Number(raw)` cobre esse `Decimal` (via
 * `valueOf()`, que devolve um `number` de verdade) e também string/number/
 * bigint, caso a expressão SQL mude no futuro.
 */
async function averageResolutionHours(): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ avg_hours: unknown }[]>`
    SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600) AS avg_hours
    FROM "Occurrence"
    WHERE status = 'RESOLVIDA' AND "resolvedAt" IS NOT NULL
  `;

  const raw = rows[0]?.avg_hours;

  return raw === null || raw === undefined ? null : Number(raw);
}

interface DailyCountRow {
  day: Date;
  count: bigint;
}

/** `YYYY-MM-DD` a partir de um `Date` já truncado por dia (UTC) pelo Postgres. */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function timeSeries(now: Date): Promise<TimeSeriesPoint[]> {
  // Uma única `$queryRaw` agrupando por dia para aberturas, outra para
  // resoluções — nunca 30 consultas (uma por dia) nem N+1. O merge com os
  // últimos 30 dias acontece em JavaScript logo abaixo.
  const [openedRows, resolvedRows] = await Promise.all([
    prisma.$queryRaw<DailyCountRow[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
      FROM "Occurrence"
      WHERE "createdAt" >= now() - interval '30 days'
      GROUP BY day
    `,
    prisma.$queryRaw<DailyCountRow[]>`
      SELECT date_trunc('day', "resolvedAt") AS day, COUNT(*) AS count
      FROM "Occurrence"
      WHERE "resolvedAt" IS NOT NULL AND "resolvedAt" >= now() - interval '30 days'
      GROUP BY day
    `,
  ]);

  const openedByDate = new Map(openedRows.map((r) => [toISODate(r.day), Number(r.count)]));
  const resolvedByDate = new Map(resolvedRows.map((r) => [toISODate(r.day), Number(r.count)]));

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const points: TimeSeriesPoint[] = [];
  for (let i = TIME_SERIES_DAYS - 1; i >= 0; i -= 1) {
    const date = new Date(today.getTime() - i * MS_PER_DAY);
    const isoDate = toISODate(date);

    points.push({
      date: isoDate,
      opened: openedByDate.get(isoDate) ?? 0,
      resolved: resolvedByDate.get(isoDate) ?? 0,
    });
  }

  return points;
}

async function topResponsibles(): Promise<ResponsibleCount[]> {
  const rows = await prisma.occurrence.groupBy({
    by: ['assignedToId'],
    where: { assignedToId: { not: null } },
    _count: true,
    orderBy: { _count: { assignedToId: 'desc' } },
    take: TOP_RESPONSIBLES_LIMIT,
  });

  if (rows.length === 0) {
    return [];
  }

  const userIds = rows.map((r) => r.assignedToId).filter((id): id is string => id !== null);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return rows
    .filter((r): r is typeof r & { assignedToId: string } => r.assignedToId !== null)
    .map((r) => ({
      userId: r.assignedToId,
      userName: nameById.get(r.assignedToId) ?? r.assignedToId,
      count: r._count,
    }));
}

async function averageRating(): Promise<number | null> {
  const result = await prisma.rating.aggregate({ _avg: { score: true } });

  return result._avg.score;
}

/**
 * Implementação Prisma da port `DashboardRepository`. Visão gerencial de
 * tudo, sem recorte por ator — nenhum `where` de escopo em nenhuma das
 * consultas abaixo (ver `get-dashboard-metrics.ts`).
 */
export const prismaDashboardRepository: DashboardRepository = {
  async getMetrics(now: Date, overdueDays: number): Promise<DashboardMetrics> {
    const [
      statusCounts,
      categoryCounts,
      priorityCounts,
      overdue,
      avgResolutionHours,
      series,
      responsibles,
      avgRating,
    ] = await Promise.all([
      totalByStatus(),
      totalByCategory(),
      totalByPriority(),
      overdueCount(now, overdueDays),
      averageResolutionHours(),
      timeSeries(now),
      topResponsibles(),
      averageRating(),
    ]);

    return {
      totalByStatus: statusCounts,
      totalByCategory: categoryCounts,
      totalByPriority: priorityCounts,
      overdueCount: overdue,
      overdueDays,
      averageResolutionHours: avgResolutionHours,
      timeSeries: series,
      topResponsibles: responsibles,
      averageRating: avgRating,
    };
  },
};
