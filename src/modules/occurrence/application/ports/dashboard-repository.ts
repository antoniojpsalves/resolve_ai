import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';
import type { Priority } from '@/modules/occurrence/domain/priority';

export interface StatusCount {
  status: OccurrenceStatus;
  count: number;
}

export interface CategoryCount {
  categoryId: string;
  categoryName: string;
  count: number;
}

export interface PriorityCount {
  priority: Priority;
  count: number;
}

export interface TimeSeriesPoint {
  /** Data no formato `YYYY-MM-DD`, UTC. */
  date: string;
  opened: number;
  resolved: number;
}

export interface ResponsibleCount {
  userId: string;
  userName: string;
  count: number;
}

export interface DashboardMetrics {
  totalByStatus: StatusCount[];
  totalByCategory: CategoryCount[];
  totalByPriority: PriorityCount[];
  /** Ocorrências ainda não terminais, abertas há mais de `overdueDays` dias. */
  overdueCount: number;
  overdueDays: number;
  /** `null` quando nenhuma ocorrência foi resolvida ainda (não é `0`, que seria enganoso). */
  averageResolutionHours: number | null;
  /** Últimos 30 dias, um ponto por dia, incluindo dias com contagem zero (sem buraco). */
  timeSeries: TimeSeriesPoint[];
  /** Até 5, ordenado por `count` desc, exclui ocorrências sem responsável. */
  topResponsibles: ResponsibleCount[];
  /** `null` quando nenhuma avaliação existe ainda. */
  averageRating: number | null;
}

export interface DashboardRepository {
  getMetrics(now: Date, overdueDays: number): Promise<DashboardMetrics>;
}
