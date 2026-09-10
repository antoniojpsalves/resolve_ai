'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { rateOccurrenceSchema } from '@/modules/occurrence/application/rate-occurrence';

/**
 * Só para o `zodResolver` deste formulário — não altera `rateOccurrenceSchema`
 * (contrato do servidor, usado pelos testes de integração). O
 * `react-hook-form` precisa de `defaultValues.comment = ''` para manter o
 * `<Textarea>` controlado, mas `comment` é `z.string().trim().min(1).optional()`:
 * aceita a chave *ausente*, rejeita a chave presente e vazia. Sem este ajuste,
 * um usuário que nunca toca no campo "opcional" nunca consegue submeter.
 *
 * `z.union([literal(''), campo original]).transform(...)` em vez de
 * `z.preprocess`: o `.transform` preserva o tipo de entrada real do campo
 * (`string | undefined`) para o `zodResolver`/`useForm`; `z.preprocess`
 * declara a entrada como `unknown` (limitação do próprio Zod), o que quebra a
 * inferência de tipos entre `useForm<RatingFormValues>` e o resolver. Só a
 * string vazia exata vira `undefined` — texto só com espaços continua
 * reprovado pelo `.trim().min(1)` original, como antes.
 */
const formSchema = rateOccurrenceSchema.extend({
  comment: z
    .union([z.literal(''), rateOccurrenceSchema.shape.comment])
    .transform((value) => (value === '' ? undefined : value)),
});

type RatingFormValues = z.infer<typeof formSchema>;

interface ProblemBody {
  title?: string;
  detail?: string;
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

/**
 * Só aparece para o autor, ocorrência `RESOLVIDA`, ainda sem avaliação
 * (decidido por quem renderiza, `ocorrencias/[id]/page.tsx`). Mesmo padrão de
 * `CommentForm`: `react-hook-form` + `zodResolver(rateOccurrenceSchema)`,
 * `fetch` direto, erro de servidor lido de `problem.detail`,
 * `router.refresh()` no sucesso — que troca este formulário pela avaliação
 * read-only assim que `detail.rating` deixa de ser `null`.
 */
export function RatingForm({ occurrenceId }: { occurrenceId: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);

  const form = useForm<RatingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { score: 0, comment: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: RatingFormValues) {
    setFormError(null);

    // Corpo montado explicitamente (não `JSON.stringify(values)` direto):
    // `comment` só entra no body quando o usuário de fato escreveu algo —
    // não confiamos em `JSON.stringify` para "omitir" uma chave `undefined`
    // de forma implícita.
    const body: RatingFormValues = {
      score: values.score,
      ...(values.comment ? { comment: values.comment } : {}),
    };

    try {
      const response = await fetch(`/api/v1/occurrences/${occurrenceId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as ProblemBody | null;
        setFormError(problem?.detail ?? problem?.title ?? 'Não foi possível enviar a avaliação.');
        return;
      }

      router.refresh();
    } catch {
      setFormError('Não foi possível enviar a avaliação. Tente novamente.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3">
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
          name="score"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nota</FormLabel>
              <FormControl>
                <div
                  className="flex gap-1"
                  onMouseLeave={() => setHoveredScore(null)}
                  role="group"
                  aria-label="Avaliação em estrelas"
                >
                  {STAR_VALUES.map((value) => {
                    const filled = value <= (hoveredScore ?? field.value ?? 0);

                    return (
                      <button
                        key={value}
                        type="button"
                        aria-label={`Avaliar com ${value} estrela${value > 1 ? 's' : ''}`}
                        onMouseEnter={() => setHoveredScore(value)}
                        onFocus={() => setHoveredScore(value)}
                        onBlur={() => setHoveredScore(null)}
                        onClick={() => field.onChange(value)}
                        className="focus-visible:ring-ring/50 rounded focus-visible:ring-[3px] focus-visible:outline-none"
                      >
                        <Star
                          className={
                            filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
                          }
                          aria-hidden
                        />
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comentário (opcional)</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Conte como foi o atendimento" {...field} />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {isSubmitting ? 'Enviando…' : 'Avaliar'}
        </Button>
      </form>
    </Form>
  );
}
