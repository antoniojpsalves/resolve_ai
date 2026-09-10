'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { statusLabel } from '@/lib/occurrences/status';
import type { StatusCount } from '@/modules/occurrence/application/ports/dashboard-repository';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

/**
 * Recharts não aceita classe Tailwind em `fill` — só cor computada
 * (hex/CSS). Cores próximas da mesma família semântica de
 * `statusBadgeClassName` (azul/âmbar/índigo/verde/vermelho, ver
 * `src/lib/occurrences/status.ts`); não precisa ser pixel-idêntico ao
 * Tailwind, só reconhecível como a mesma cor.
 */
const STATUS_CHART_COLORS: Record<OccurrenceStatus, string> = {
  ABERTA: '#2563eb', // blue-600
  EM_ANALISE: '#d97706', // amber-600
  EM_ATENDIMENTO: '#4f46e5', // indigo-600
  RESOLVIDA: '#16a34a', // green-600
  CANCELADA: '#dc2626', // red-600
};

interface StatusChartProps {
  data: StatusCount[];
}

/**
 * Barras de `totalByStatus`, uma por status, na ordem que o backend já
 * devolve (`ALL_STATUSES`, ver `dashboard-repository.ts`) — não reordena.
 */
export function StatusChart({ data }: StatusChartProps) {
  const chartData = data.map((item) => ({
    status: item.status,
    label: statusLabel(item.status),
    count: item.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
        <Tooltip />
        <Bar dataKey="count" name="Ocorrências" radius={[4, 4, 0, 0]}>
          {chartData.map((item) => (
            <Cell key={item.status} fill={STATUS_CHART_COLORS[item.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
