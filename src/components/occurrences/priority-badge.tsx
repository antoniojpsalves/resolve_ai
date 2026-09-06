import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import { priorityBadgeClassName, priorityLabel } from '@/lib/occurrences/priority';
import type { Priority } from '@/modules/occurrence/domain/priority';

/**
 * Único componente de badge de prioridade do projeto — mesma justificativa de
 * `StatusBadge`: nenhuma tela repete o mapa cor/rótulo de prioridade.
 */
export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent', priorityBadgeClassName(priority), className)}
    >
      {priorityLabel(priority)}
    </Badge>
  );
}
