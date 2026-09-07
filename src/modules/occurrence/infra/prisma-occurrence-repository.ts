import { Prisma } from '@prisma/client';

import { prisma } from '@/core/db/prisma';

import type {
  AddCommentData,
  CommentEntry,
  CreateOccurrenceData,
  ListOccurrencesQuery,
  ListOccurrencesResult,
  OccurrenceDetail,
  OccurrenceRecord,
  OccurrenceRepository,
} from '../application/ports/occurrence-repository';
import { OccurrenceCodeConflictError } from '../application/ports/occurrence-repository';
import { fileStorage } from './file-storage';
import {
  toCommentEntry,
  toOccurrenceDetail,
  toOccurrenceListItem,
  toOccurrenceRecord,
} from './mappers';

/** Código do Prisma para violação de constraint única (mesmo usado em `prisma-user-repository.ts`). */
const UNIQUE_VIOLATION = 'P2002';

/** O prefixo do `code` para um ano: `OC-2026-`. */
function codePrefix(year: number): string {
  return `OC-${String(year).padStart(4, '0')}-`;
}

/** `true` só quando o P2002 for da constraint `@unique` de `code` — não de qualquer outra unique da tabela. */
function isCodeUniqueViolation(error: Prisma.PrismaClientKnownRequestError): boolean {
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];

  return fields.includes('code');
}

function buildWhere(query: ListOccurrencesQuery): Prisma.OccurrenceWhereInput {
  const where: Prisma.OccurrenceWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.priority) where.priority = query.priority;
  if (query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.createdById) where.createdById = query.createdById;

  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
      { code: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  return where;
}

/**
 * Implementação Prisma da port `OccurrenceRepository`. Único lugar desta
 * tarefa (além de `mappers.ts` e `prisma-category-repository.ts`) onde
 * `@prisma/client` aparece.
 */
export const prismaOccurrenceRepository: OccurrenceRepository = {
  async create(input: CreateOccurrenceData): Promise<OccurrenceRecord> {
    try {
      // `$transaction`: a ocorrência e a entrada inicial de `StatusHistory`
      // (fromStatus: null) são gravadas atomicamente — não pode existir
      // ocorrência sem essa entrada de auditoria (garantia do projeto).
      const row = await prisma.$transaction(async (tx) => {
        const occurrence = await tx.occurrence.create({
          data: {
            code: input.code,
            title: input.title,
            description: input.description,
            categoryId: input.categoryId,
            locationLabel: input.locationLabel,
            latitude: input.latitude,
            longitude: input.longitude,
            // `imageUrl` não entra aqui de propósito: a coluna fica sempre
            // null na criação — a URL de leitura é derivada de `imageKey`
            // pelo `FileStorage` ativo no momento de cada leitura, nunca
            // gravada (ver `CreateOccurrenceData` e `findById` abaixo).
            imageKey: input.imageKey,
            createdById: input.createdById,
            status: 'ABERTA',
            priority: 'MEDIA',
          },
          // `categoryName` (`OccurrenceRecord`) sai daqui: resolver o nome no
          // mesmo INSERT evita uma segunda consulta logo depois de criar.
          include: { category: { select: { name: true } } },
        });

        await tx.statusHistory.create({
          data: {
            occurrenceId: occurrence.id,
            fromStatus: null,
            toStatus: 'ABERTA',
            changedById: input.createdById,
          },
        });

        return occurrence;
      });

      const imageUrl = row.imageKey ? await fileStorage.urlForKey(row.imageKey) : null;

      return toOccurrenceRecord(row, imageUrl);
    } catch (error) {
      // Corrida do protocolo (ver `create-occurrence.ts`): dois
      // `POST /occurrences` simultâneos podem ler `nextSequenceForYear`
      // antes de qualquer um confirmar o `create`, calculando o mesmo
      // `code` — o segundo INSERT esbarra na constraint `@unique` (P2002).
      // Traduzimos para `OccurrenceCodeConflictError` (mesmo padrão de
      // `prisma-user-repository.ts` para e-mail duplicado) para que o
      // use-case recalcule a sequência e tente de novo, em vez de vazar um
      // erro de infraestrutura para o cliente HTTP.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION &&
        isCodeUniqueViolation(error)
      ) {
        throw new OccurrenceCodeConflictError();
      }

      throw error;
    }
  },

  async list(query: ListOccurrencesQuery): Promise<ListOccurrencesResult> {
    const where = buildWhere(query);

    const [rows, total] = await Promise.all([
      prisma.occurrence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        // `categoryName` resolvido aqui: a tela de lista não busca mais o
        // catálogo inteiro para fazer join na mão (ver `OccurrenceListItem`).
        include: { category: { select: { name: true } } },
      }),
      prisma.occurrence.count({ where }),
    ]);

    return { data: rows.map(toOccurrenceListItem), total };
  },

  async findById(id: string): Promise<OccurrenceDetail | null> {
    const row = await prisma.occurrence.findUnique({
      where: { id },
      include: {
        // `select: { name: true }` em vez de `include` puro: só o nome de
        // exibição precisa sair do banco, nunca o hash de senha ou o e-mail
        // (ver `mappers.ts` — `changedByName`/`authorName`/`assignedToName`/
        // `categoryName` resolvem o `id` bruto para a UI).
        category: { select: { name: true } },
        assignedTo: { select: { name: true } },
        history: {
          orderBy: { createdAt: 'asc' },
          include: { changedBy: { select: { name: true } } },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true } } },
        },
        rating: true,
      },
    });

    if (!row) {
      return null;
    }

    const imageUrl = row.imageKey ? await fileStorage.urlForKey(row.imageKey) : null;

    return toOccurrenceDetail(row, imageUrl);
  },

  async addComment(input: AddCommentData): Promise<CommentEntry> {
    const row = await prisma.comment.create({
      data: {
        occurrenceId: input.occurrenceId,
        authorId: input.authorId,
        body: input.body,
      },
      include: { author: { select: { name: true } } },
    });

    return toCommentEntry(row);
  },

  async nextSequenceForYear(year: number): Promise<number> {
    const prefix = codePrefix(year);

    const last = await prisma.occurrence.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    if (!last) {
      return 1;
    }

    const sequence = Number.parseInt(last.code.slice(prefix.length), 10);

    return Number.isNaN(sequence) ? 1 : sequence + 1;
  },
};
