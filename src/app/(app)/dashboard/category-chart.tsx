'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { CategoryCount } from '@/modules/occurrence/application/ports/dashboard-repository';

/** Cor única — não há convenção de cor por categoria no projeto. */
const CATEGORY_BAR_COLOR = '#2563eb'; // blue-600

interface CategoryChartProps {
  data: CategoryCount[];
}

/**
 * Barras de `totalByCategory`, ordenadas por `count` desc no cliente antes de
 * renderizar. O backend não garante `orderBy` nesta lista (achado da revisão
 * da Tarefa 1, `docs/sdd/dia-04/tarefa-1-review.md`, item de severidade
 * baixa #1) — sem este sort, a ordem das barras podia "pular" entre
 * refreshes sem nenhuma mudança de dado real.
 */
export function CategoryChart({ data }: CategoryChartProps) {
  const chartData = [...data].sort((a, b) => b.count - a.count);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="categoryName"
          tick={{ fontSize: 12 }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={48}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
        <Tooltip />
        <Bar dataKey="count" name="Ocorrências" fill={CATEGORY_BAR_COLOR} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
