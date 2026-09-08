import { describe, expect, it, vi } from 'vitest';

import {
  dashboardMetricsQuerySchema,
  getDashboardMetrics,
} from '@/modules/occurrence/application/get-dashboard-metrics';
import type { DashboardMetrics } from '@/modules/occurrence/application/ports/dashboard-repository';

const FIXED_METRICS: DashboardMetrics = {
  totalByStatus: [{ status: 'ABERTA', count: 3 }],
  totalByCategory: [{ categoryId: 'cat-1', categoryName: 'Iluminação', count: 3 }],
  totalByPriority: [{ priority: 'MEDIA', count: 3 }],
  overdueCount: 1,
  overdueDays: 7,
  averageResolutionHours: 12.5,
  timeSeries: [{ date: '2026-09-01', opened: 1, resolved: 0 }],
  topResponsibles: [{ userId: 'user-1', userName: 'Fulano', count: 2 }],
  averageRating: 4.5,
};

describe('getDashboardMetrics', () => {
  it('repassa overdueDays ao repositório e devolve as métricas como vieram', async () => {
    const getMetrics = vi.fn().mockResolvedValue(FIXED_METRICS);

    const result = await getDashboardMetrics({ overdueDays: 15 }, { dashboard: { getMetrics } });

    expect(getMetrics).toHaveBeenCalledWith(expect.any(Date), 15);
    expect(result).toEqual(FIXED_METRICS);
  });
});

describe('dashboardMetricsQuerySchema', () => {
  it('usa o default 7 quando overdueDays está ausente', () => {
    const result = dashboardMetricsQuerySchema.parse({});

    expect(result).toEqual({ overdueDays: 7 });
  });

  it('aceita um overdueDays customizado, coagindo string para number', () => {
    const result = dashboardMetricsQuerySchema.parse({ overdueDays: '30' });

    expect(result).toEqual({ overdueDays: 30 });
  });

  it('rejeita overdueDays = 0', () => {
    expect(() => dashboardMetricsQuerySchema.parse({ overdueDays: '0' })).toThrow();
  });

  it('rejeita overdueDays negativo', () => {
    expect(() => dashboardMetricsQuerySchema.parse({ overdueDays: '-1' })).toThrow();
  });

  it('rejeita overdueDays não-numérico', () => {
    expect(() => dashboardMetricsQuerySchema.parse({ overdueDays: 'abacate' })).toThrow();
  });
});
