'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL_PRIORITIES, priorityLabel } from '@/lib/occurrences/priority';
import type { Priority } from '@/modules/occurrence/domain/priority';

interface ProblemBody {
  title?: string;
  detail?: string;
}

/** Sentinela para "sem responsável" — mesmo padrão de `ANY_VALUE` em `occurrence-filters.tsx`, mas com nome próprio: aqui o significado é "ninguém atribuído", não "sem filtro". */
const UNASSIGNED_VALUE = 'NINGUEM';

interface ManagementPanelProps {
  occurrenceId: string;
  currentPriority: Priority;
  currentAssignedToId: string | null;
  managers: { id: string; name: string }[];
}

/**
 * Só GESTOR vê este painel (decidido por quem renderiza, `ocorrencias/[id]/page.tsx`).
 * Cada `<Select>` dispara seu próprio `PATCH` ao mudar — sem botão "Salvar",
 * mesmo espírito reativo dos `<Select>` de `occurrence-filters.tsx`. Erro vira
 * um toast passageiro (`sonner`), não um `<p role="alert">` persistente: não
 * há estado de formulário aqui, é uma ação disparada por seleção.
 */
export function ManagementPanel({
  occurrenceId,
  currentPriority,
  currentAssignedToId,
  managers,
}: ManagementPanelProps) {
  const router = useRouter();

  async function patch(body: Record<string, unknown>) {
    try {
      const response = await fetch(`/api/v1/occurrences/${occurrenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as ProblemBody | null;
        toast.error(problem?.detail ?? problem?.title ?? 'Não foi possível salvar a alteração.');
        return;
      }

      router.refresh();
    } catch {
      toast.error('Não foi possível salvar a alteração. Tente novamente.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold">Gestão</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="management-priority">Prioridade</Label>
          <Select value={currentPriority} onValueChange={(value) => patch({ priority: value })}>
            <SelectTrigger id="management-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priorityLabel(priority)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="management-assigned">Responsável</Label>
          <Select
            value={currentAssignedToId ?? UNASSIGNED_VALUE}
            onValueChange={(value) =>
              patch({ assignedToId: value === UNASSIGNED_VALUE ? null : value })
            }
          >
            <SelectTrigger id="management-assigned" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED_VALUE}>Ninguém</SelectItem>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
