import { z } from 'zod';

import type { DashboardMetrics, DashboardRepository } from './ports/dashboard-repository';

const DEFAULT_OVERDUE_DAYS = 7;

export const dashboardMetricsQuerySchema = z
  .object({
    overdueDays: z.coerce.number().int().min(1).max(365).default(DEFAULT_OVERDUE_DAYS),
  })
  .strip();

export type DashboardMetricsQueryInput = z.infer<typeof dashboardMetricsQuerySchema>;

export interface GetDashboardMetricsDeps {
  dashboard: DashboardRepository;
}

/**
 * Devolve os indicadores gerenciais do dashboard (`docs/PLANO.md`, seção 5).
 * Sem lógica de negócio própria além do repasse: nenhum recorte por ator (a
 * visão é sempre a mesma, gerencial, para qualquer `GESTOR`) — a checagem de
 * papel é responsabilidade da rota (`requireRole('GESTOR')`), não deste
 * use-case.
 */
export async function getDashboardMetrics(
  input: DashboardMetricsQueryInput,
  { dashboard }: GetDashboardMetricsDeps,
): Promise<DashboardMetrics> {
  return dashboard.getMetrics(new Date(), input.overdueDays);
}
