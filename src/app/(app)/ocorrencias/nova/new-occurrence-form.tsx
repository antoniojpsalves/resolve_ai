'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createOccurrenceSchema } from '@/modules/occurrence/application/create-occurrence';
import type { CategorySummary } from '@/modules/occurrence/application/ports/category-repository';
import { MAX_UPLOAD_SIZE_BYTES } from '@/modules/occurrence/application/upload-image';

/**
 * Reusa o schema Zod do use-case (`create-occurrence.ts`) em vez de reescrever
 * as regras — mesmo padrão de `register-form.tsx` com `PASSWORD_RULE`. Só os
 * quatro campos de texto entram no formulário: a imagem é tratada à parte
 * (upload prévio, ver `onSubmit`) e `imageKey` só existe depois que o upload
 * responde.
 */
const newOccurrenceFormSchema = createOccurrenceSchema.pick({
  title: true,
  description: true,
  categoryId: true,
  locationLabel: true,
});

type NewOccurrenceFormValues = z.infer<typeof newOccurrenceFormSchema>;

const FIELD_NAMES = ['title', 'description', 'categoryId', 'locationLabel'] as const;
type FieldName = (typeof FIELD_NAMES)[number];

function isFieldName(path: string): path is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(path);
}

/**
 * Mesmos três formatos aceitos pelo use-case de upload (`detectImageFormat`),
 * checados aqui pelo `type` do `File` só para feedback rápido — a validação
 * de verdade acontece no servidor pelos magic bytes do conteúdo, então um
 * arquivo que engane este filtro ainda é barrado lá.
 */
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_SIZE_MB = MAX_UPLOAD_SIZE_BYTES / (1024 * 1024);

interface ProblemBody {
  title?: string;
  detail?: string;
  errors?: { path: string; message: string }[];
}

type SubmitStage = 'idle' | 'uploading' | 'creating';

const STAGE_LABEL: Record<Exclude<SubmitStage, 'idle'>, string> = {
  uploading: 'Enviando imagem…',
  creating: 'Criando ocorrência…',
};

export function NewOccurrenceForm({ categories }: { categories: CategorySummary[] }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<SubmitStage>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<NewOccurrenceFormValues>({
    resolver: zodResolver(newOccurrenceFormSchema),
    defaultValues: { title: '', description: '', categoryId: '', locationLabel: '' },
  });

  const isSubmitting = stage !== 'idle';

  function resetImage() {
    setImageFile(null);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageError(null);

    if (!file) {
      resetImage();
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Envie uma imagem JPEG, PNG ou WebP.');
      resetImage();
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setImageError(`A imagem excede o limite de ${MAX_UPLOAD_SIZE_MB} MB.`);
      resetImage();
      return;
    }

    setImageFile(file);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  async function uploadImage(file: File): Promise<{ url: string; key: string } | null> {
    const body = new FormData();
    body.append('file', file);

    const response = await fetch('/api/v1/uploads', { method: 'POST', body });

    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as ProblemBody | null;
      setImageError(problem?.detail ?? problem?.title ?? 'Não foi possível enviar a imagem.');
      return null;
    }

    return (await response.json()) as { url: string; key: string };
  }

  async function onSubmit(values: NewOccurrenceFormValues) {
    setFormError(null);
    setImageError(null);

    try {
      let imageKey: string | undefined;

      if (imageFile) {
        setStage('uploading');
        const uploaded = await uploadImage(imageFile);

        if (!uploaded) {
          setStage('idle');
          return;
        }

        imageKey = uploaded.key;
      }

      setStage('creating');

      // Só a chave viaja para `POST /occurrences` — o servidor deriva a URL
      // de leitura a partir dela; nunca enviamos `uploaded.url` (a API não
      // aceita mais URL de imagem como entrada).
      const response = await fetch('/api/v1/occurrences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, imageKey }),
      });

      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as ProblemBody | null;

        for (const issue of problem?.errors ?? []) {
          if (isFieldName(issue.path)) {
            form.setError(issue.path, { message: issue.message });
          }
        }

        setFormError(
          problem?.detail ??
            problem?.title ??
            'Não foi possível criar a ocorrência. Tente novamente.',
        );
        setStage('idle');
        return;
      }

      const occurrence = (await response.json()) as { id: string };

      // O protocolo (`code`) é mostrado no cabeçalho do próprio detalhe — não
      // precisa duplicar aqui um toast com o mesmo dado.
      router.push(`/ocorrencias/${occurrence.id}`);
    } catch {
      setFormError('Não foi possível criar a ocorrência. Tente novamente.');
      setStage('idle');
    }
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Vazamento no corredor do bloco B" {...field} />
                  </FormControl>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Descreva o que está acontecendo" {...field} />
                  </FormControl>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locationLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Localização</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Bloco B, garagem -1" {...field} />
                  </FormControl>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />

            <div className="grid gap-2">
              <Label htmlFor="occurrence-image">Foto (opcional)</Label>
              <input
                ref={fileInputRef}
                id="occurrence-image"
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={handleFileChange}
                className="text-muted-foreground file:text-foreground text-sm file:mr-3 file:rounded-md file:border-0 file:bg-transparent file:text-sm file:font-medium"
                aria-describedby={imageError ? 'occurrence-image-error' : undefined}
              />

              {imagePreviewUrl ? (
                <div className="relative w-fit">
                  {/* Preview local (object URL), não a URL final do storage — usar <img> simples evita a config de domínios remotos do next/image para um blob temporário. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Pré-visualização da imagem selecionada"
                    className="h-40 w-auto rounded-md border object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute -top-2 -right-2"
                    onClick={resetImage}
                    aria-label="Remover imagem selecionada"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : null}

              {imageError ? (
                <p id="occurrence-image-error" role="alert" className="text-destructive text-sm">
                  {imageError}
                </p>
              ) : null}
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {stage === 'idle' ? 'Criar ocorrência' : STAGE_LABEL[stage]}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
