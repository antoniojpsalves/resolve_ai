import { Skeleton } from '@/components/ui/skeleton';

/**
 * UI de carregamento nativa do App Router: some assim que o Server Component
 * de `page.tsx` termina de buscar os dados. Cobre tanto a navegação inicial
 * quanto trocas de filtro/página (cada uma é uma nova navegação).
 */
export default function OcorrenciasLoading() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Skeleton className="h-24 w-full" />

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    </section>
  );
}
