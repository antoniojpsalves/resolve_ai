import { z } from 'zod';

import { ConflictError, NotFoundError } from '@/core/errors';
import { buildOccurrenceCode } from '@/modules/occurrence/domain/protocol';
import type { Actor } from '@/modules/occurrence/domain/occurrence';

import type { CategoryRepository } from './ports/category-repository';
import {
  OccurrenceCodeConflictError,
  type OccurrenceRecord,
  type OccurrenceRepository,
} from './ports/occurrence-repository';

/** Quantas vezes o use-case tenta um novo `code` antes de desistir (item 4 do brief). */
const MAX_SEQUENCE_ATTEMPTS = 5;

/**
 * `imageUrl` aceita tanto uma URL absoluta (`https://...`, o que o Vercel
 * Blob devolve em produção — ver `infra/blob-file-storage.ts`) quanto um
 * caminho relativo iniciado por uma única barra (o que o storage local
 * devolve em desenvolvimento/Docker — `/api/v1/uploads/<key>`, servido por
 * `GET /api/v1/uploads/[...key]`). `z.string().url()` sozinho rejeitaria a
 * segunda forma, que é exatamente o valor real devolvido pelo upload em
 * desenvolvimento (Tarefa 3).
 *
 * O ramo relativo exige `/` seguida de algo que **não** é outra `/`
 * (`\/(?!\/)`) — sem isso, `//evil.com/x.png` também casaria (a primeira
 * barra satisfaz `\/`, o resto satisfaz `\S+`), e isso é uma URL
 * protocol-relative de verdade: um navegador resolve `src="//evil.com/x.png"`
 * como `https://evil.com/x.png`. Hoje o valor só é guardado e devolvido, mas
 * a Tarefa 4 renderiza `<img src={imageUrl}>` — nesse ponto, aceitar
 * protocol-relative vira carregar recurso de host arbitrário a partir de um
 * campo que deveria apontar só para o próprio storage.
 */
const IMAGE_URL_PATTERN = /^(?:https?:\/\/\S+|\/(?!\/)\S+)$/;

export const createOccurrenceSchema = z
  .object({
    title: z.string().trim().min(1, 'O título é obrigatório'),
    description: z.string().trim().min(1, 'A descrição é obrigatória'),
    categoryId: z.string().trim().min(1, 'A categoria é obrigatória'),
    locationLabel: z.string().trim().min(1, 'A localização é obrigatória'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    imageUrl: z.string().trim().regex(IMAGE_URL_PATTERN, 'URL de imagem inválida').optional(),
    imageKey: z.string().trim().min(1).optional(),
  })
  .strip();

export type CreateOccurrenceInput = z.infer<typeof createOccurrenceSchema>;

export interface CreateOccurrenceDeps {
  occurrences: OccurrenceRepository;
  categories: CategoryRepository;
}

/**
 * Cria uma ocorrência.
 *
 * Regras:
 *  - qualquer usuário autenticado pode criar (solicitante e gestor) — não há
 *    checagem de papel aqui;
 *  - `status` inicial é sempre `ABERTA`, `priority` inicial sempre `MEDIA`
 *    (fixados pela implementação da port, não escolhidos pelo chamador);
 *  - categoria inexistente ou inativa vira `NotFoundError` — tratamos os dois
 *    casos da mesma forma porque, do ponto de vista de quem cria a ocorrência,
 *    uma categoria inativa não é uma opção válida, então "não existe para
 *    uso" é a resposta correta (e evita um segundo tipo de erro só para essa
 *    distinção);
 *  - o `code` (`OC-<ano>-NNNNNN`) é gerado a partir do ano corrente e da
 *    próxima sequência anual — ver o retry logo abaixo.
 */
export async function createOccurrence(
  input: CreateOccurrenceInput,
  actor: Actor,
  { occurrences, categories }: CreateOccurrenceDeps,
): Promise<OccurrenceRecord> {
  const category = await categories.findById(input.categoryId);

  if (!category || !category.active) {
    throw new NotFoundError('Categoria não encontrada', {
      detail: 'A categoria informada não existe ou está inativa.',
    });
  }

  const year = new Date().getUTCFullYear();

  for (let attempt = 1; attempt <= MAX_SEQUENCE_ATTEMPTS; attempt += 1) {
    const sequence = await occurrences.nextSequenceForYear(year);
    const code = buildOccurrenceCode(year, sequence);

    try {
      return await occurrences.create({
        code,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        locationLabel: input.locationLabel,
        latitude: input.latitude,
        longitude: input.longitude,
        imageUrl: input.imageUrl,
        imageKey: input.imageKey,
        createdById: actor.id,
      });
    } catch (error) {
      // Corrida: dois `POST /occurrences` simultâneos podem ler
      // `nextSequenceForYear` antes de qualquer um confirmar o `create` —
      // os dois calculam o mesmo `code` e o segundo INSERT esbarra na
      // constraint `@unique`. A implementação Prisma traduz esse P2002 em
      // `OccurrenceCodeConflictError` (mesmo padrão de `prisma-user-repository.ts`
      // para e-mail duplicado); aqui a resposta é recalcular a sequência e
      // tentar de novo, em vez de propagar o conflito ao cliente.
      if (error instanceof OccurrenceCodeConflictError) {
        continue;
      }

      throw error;
    }
  }

  throw new ConflictError('Não foi possível gerar um protocolo único', {
    detail: `Todas as ${MAX_SEQUENCE_ATTEMPTS} tentativas de gerar um código de protocolo colidiram. Tente novamente.`,
  });
}
