import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import { statusBadgeClassName, statusLabel } from '@/lib/occurrences/status';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

/**
 * Único componente de badge de status do projeto — as três telas do
 * solicitante (nova ocorrência não usa, mas lista e detalhe usam) importam
 * este componente em vez de repetir o mapa cor/rótulo (item do brief).
 * Sempre mostra o texto do status junto da cor: a cor nunca é o único
 * indicador (requisito de acessibilidade do brief).
 */
export function StatusBadge({
  status,
  className,
}: {
  status: OccurrenceStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent', statusBadgeClassName(status), className)}
    >
      {statusLabel(status)}
    </Badge>
  );
}
