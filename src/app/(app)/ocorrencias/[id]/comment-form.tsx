'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

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
import { addCommentSchema } from '@/modules/occurrence/application/add-comment';

type CommentFormValues = z.infer<typeof addCommentSchema>;

interface ProblemBody {
  title?: string;
  detail?: string;
}

/**
 * Client Component só para a interação de comentar — o resto do detalhe é
 * Server Component. Depois do `POST` bem-sucedido, `router.refresh()` busca
 * de novo os dados do Server Component pai (sem recarregar a página inteira),
 * que é como o novo comentário aparece na lista logo acima.
 */
export function CommentForm({ occurrenceId }: { occurrenceId: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(addCommentSchema),
    defaultValues: { body: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: CommentFormValues) {
    setFormError(null);

    try {
      const response = await fetch(`/api/v1/occurrences/${occurrenceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as ProblemBody | null;
        setFormError(problem?.detail ?? problem?.title ?? 'Não foi possível enviar o comentário.');
        return;
      }

      form.reset();
      router.refresh();
    } catch {
      setFormError('Não foi possível enviar o comentário. Tente novamente.');
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
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adicionar comentário</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Escreva um comentário" {...field} />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {isSubmitting ? 'Enviando…' : 'Comentar'}
        </Button>
      </form>
    </Form>
  );
}
