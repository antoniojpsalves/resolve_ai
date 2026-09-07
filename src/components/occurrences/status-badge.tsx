import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import { statusBadgeClassName, statusLabel } from '@/lib/occurrences/status';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

/**
 * Único componente de badge de status do projeto — lista e detalhe importam
 * este componente em vez de repetir o mapa cor/rótulo, para as duas telas
 * nunca divergirem sobre que cor/texto representa cada status. Sempre
 * mostra o texto do status junto da cor: a cor nunca é o único indicador,
 * por acessibilidade (daltonismo, leitor de tela).
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
