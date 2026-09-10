'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { statusLabel } from '@/lib/occurrences/status';
import { changeOccurrenceStatusSchema } from '@/modules/occurrence/application/change-occurrence-status';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

/**
 * Só para o `zodResolver` deste formulário — não altera
 * `changeOccurrenceStatusSchema` (contrato do servidor, usado pelos testes de
 * integração). `defaultValues` sempre semeia `note` e `resolutionNote` com
 * `''` (mantém o `<Textarea>` controlado independente de qual dos dois é o
 * campo ativo para o destino atual), e os dois são
 * `z.string().trim().min(1).optional()`: aceitam a chave ausente, rejeitam a
 * chave presente e vazia. Sem este ajuste, nenhum destino consegue ser
 * submetido sem texto — nem os que não exigem nota por regra de negócio
 * (`EM_ANALISE`, `EM_ATENDIMENTO`) — porque os dois campos são validados
 * juntos a cada submit. A
 * obrigatoriedade de verdade para `CANCELADA`/`RESOLVIDA` continua sendo
 * decidida pelo servidor (`domain/transitions.ts`, `missingRequiredField`) —
 * é exatamente o que o comentário de `isNoteRequired` abaixo já previa.
 *
 * `z.union([literal(''), campo original]).transform(...)` em vez de
 * `z.preprocess`: o `.transform` preserva o tipo de entrada real do campo
 * (`string | undefined`) para o `zodResolver`/`useForm`; `z.preprocess`
 * declara a entrada como `unknown` (limitação do próprio Zod), o que quebra a
 * inferência de tipos entre `useForm<TransitionFormValues>` e o resolver. Só a
 * string vazia exata vira `undefined` — texto só com espaços continua
 * reprovado pelo `.trim().min(1)` original, como antes.
 */
const formSchema = changeOccurrenceStatusSchema.extend({
  note: z
    .union([z.literal(''), changeOccurrenceStatusSchema.shape.note])
    .transform((value) => (value === '' ? undefined : value)),
  resolutionNote: z
    .union([z.literal(''), changeOccurrenceStatusSchema.shape.resolutionNote])
    .transform((value) => (value === '' ? undefined : value)),
});

type TransitionFormValues = z.infer<typeof formSchema>;

interface ProblemBody {
  title?: string;
  detail?: string;
}

/**
 * Só marca a UI (rótulo do campo) — a obrigatoriedade de verdade é regra de
 * negócio do servidor (`missingRequiredField`, `domain/transitions.ts`). Se o
 * usuário conseguir submeter sem preencher, o `422` do servidor aparece via
 * `formError`, do mesmo jeito que `CommentForm` já trata erro de servidor.
 */
function isNoteRequired(target: OccurrenceStatus): boolean {
  return target === 'CANCELADA' || target === 'RESOLVIDA';
}

/** `CANCELADA` grava em `note`, `RESOLVIDA` em `resolutionNote`; os demais destinos também usam `note`, mas opcionalmente. */
function fieldNameForTarget(target: OccurrenceStatus): 'note' | 'resolutionNote' {
  return target === 'RESOLVIDA' ? 'resolutionNote' : 'note';
}

interface StatusTransitionPanelProps {
  occurrenceId: string;
  candidates: OccurrenceStatus[];
}

/**
 * Painel de transição de status, compartilhado entre solicitante e gestor —
 * `candidates` já vem calculado no servidor por `candidateTransitions`
 * (`ocorrencias/[id]/page.tsx`), então este componente só decide como
 * mostrar os botões, nunca quem pode ver qual botão.
 */
export function StatusTransitionPanel({ occurrenceId, candidates }: StatusTransitionPanelProps) {
  const [openTarget, setOpenTarget] = useState<OccurrenceStatus | null>(null);

  if (candidates.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold">Ações</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {candidates.map((target) => (
            <Button
              key={target}
              type="button"
              variant={openTarget === target ? 'secondary' : 'outline'}
              onClick={() => setOpenTarget((current) => (current === target ? null : target))}
            >
              {statusLabel(target)}
            </Button>
          ))}
        </div>

        {openTarget ? (
          <TransitionForm
            occurrenceId={occurrenceId}
            target={openTarget}
            onCancel={() => setOpenTarget(null)}
            onSuccess={() => setOpenTarget(null)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

interface TransitionFormProps {
  occurrenceId: string;
  target: OccurrenceStatus;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * Formulário inline de uma transição específica — reaberto do zero (via
 * `key={target}` no componente pai implícito na troca de `openTarget`) cada
 * vez que o alvo muda, para não herdar estado do formulário anterior.
 */
function TransitionForm({ occurrenceId, target, onCancel, onSuccess }: TransitionFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const fieldName = fieldNameForTarget(target);
  const required = isNoteRequired(target);

  const form = useForm<TransitionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { toStatus: target, note: '', resolutionNote: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: TransitionFormValues) {
    setFormError(null);

    const text = values[fieldName]?.trim();
    const body: Record<string, unknown> = { toStatus: target };
    if (text) {
      body[fieldName] = text;
    }

    try {
      const response = await fetch(`/api/v1/occurrences/${occurrenceId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as ProblemBody | null;
        setFormError(problem?.detail ?? problem?.title ?? 'Não foi possível mudar o status.');
        return;
      }

      router.refresh();
      onSuccess();
    } catch {
      setFormError('Não foi possível mudar o status. Tente novamente.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3 border-t pt-4">
        {formError ? (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {formError}
          </p>
        ) : null}

        <FormField
          control={form.control}
          name={fieldName}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observação{required ? ' (obrigatória)' : ' (opcional)'}</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Descreva o que aconteceu" {...field} />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isSubmitting ? 'Confirmando…' : 'Confirmar'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}
