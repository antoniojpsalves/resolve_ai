'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReactNode } from 'react';

import type { TimeSeriesPoint } from '@/modules/occurrence/application/ports/dashboard-repository';

const OPENED_COLOR = '#2563eb'; // blue-600 — mesma família de ABERTA
const RESOLVED_COLOR = '#16a34a'; // green-600 — mesma família de RESOLVIDA

/**
 * `formatDate` (`src/lib/occurrences/date.ts`) não serve para o eixo X aqui.
 * `date` (`TimeSeriesPoint.date`) é uma string `YYYY-MM-DD` "pura" — um dia
 * calendário produzido por `date_trunc('day', ...)` no Postgres, sem
 * componente de hora. `formatDate` faz `new Date('2026-09-08')` (meia-noite
 * UTC) e depois aplica `timeZone: 'America/Sao_Paulo'` (UTC-3): o resultado
 * recua 3 horas e vira `2026-09-07T21:00`, exibindo "07/09" em vez de
 * "08/09" — um bug de off-by-one confirmado empiricamente antes de escrever
 * este formatador. Ele só recorta os componentes da string, sem `Date` nem
 * fuso horário nenhum.
 */
function formatAxisDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

/** Mesmo formatador acima, mas com a assinatura que o `labelFormatter` do
 * `<Tooltip>` do Recharts exige (`label: ReactNode`, não `string`). */
function formatTooltipLabel(label: ReactNode): ReactNode {
  return typeof label === 'string' ? formatAxisDate(label) : label;
}

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

/** Linha dupla (`opened`/`resolved`) sobre os 30 pontos de `timeSeries`. */
export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatAxisDate}
          tick={{ fontSize: 12 }}
          minTickGap={16}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
        <Tooltip labelFormatter={formatTooltipLabel} />
        <Legend />
        <Line
          type="monotone"
          dataKey="opened"
          name="Abertas"
          stroke={OPENED_COLOR}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="resolved"
          name="Resolvidas"
          stroke={RESOLVED_COLOR}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
