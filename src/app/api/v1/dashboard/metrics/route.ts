import { route } from '@/core/http/handler';
import { requireRole } from '@/core/http/auth-guards';
import {
  dashboardMetricsQuerySchema,
  getDashboardMetrics,
} from '@/modules/occurrence/application/get-dashboard-metrics';
import { prismaDashboardRepository } from '@/modules/occurrence/infra/prisma-dashboard-repository';

/**
 * `GET /api/v1/dashboard/metrics` — indicadores gerenciais do dashboard
 * (`docs/PLANO.md`, seção 5). Restrita a `GESTOR`: sem sessão → 401, papel
 * diferente de `GESTOR` → 403 (`requireRole`, não `requireRoleOrRedirect` —
 * esta é uma API route, não uma página).
 *
 * `overdueDays` é opcional na query string (default 7, `dashboardMetricsQuerySchema`).
 */
export const GET = route(async (request: Request) => {
  await requireRole('GESTOR');

  const url = new URL(request.url);
  const query = dashboardMetricsQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

  const metrics = await getDashboardMetrics(query, { dashboard: prismaDashboardRepository });

  return Response.json(metrics);
});
