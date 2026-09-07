import {
  OccurrenceAlreadyRatedError,
  OccurrenceCodeConflictError,
  type AddCommentData,
  type ChangeStatusData,
  type CommentEntry,
  type CreateOccurrenceData,
  type ListOccurrencesQuery,
  type ListOccurrencesResult,
  type OccurrenceDetail,
  type OccurrenceListItem,
  type OccurrenceRecord,
  type OccurrenceRepository,
  type RateOccurrenceData,
  type RatingEntry,
  type StatusHistoryEntry,
} from '@/modules/occurrence/application/ports/occurrence-repository';
import { priorityWeight, type Priority } from '@/modules/occurrence/domain/priority';

const FIXED_NOW = new Date('2026-09-01T12:00:00.000Z');

/**
 * Placeholder óbvio para `changedByName`/`authorName` gerados internamente
 * por este fake (`create`/`addComment`) — a camada de aplicação só carrega
 * `Actor.id`, nunca um nome (quem resolve o nome de verdade é a implementação
 * Prisma, via `mappers.ts`/`prisma-occurrence-repository.ts`, coberta por
 * `mappers.test.ts`). Nenhum teste depende do conteúdo exato desta string.
 */
function fakeName(id: string): string {
  return `Nome de teste (${id})`;
}

/**
 * Mesmo placeholder de `fakeName`, para `categoryName`: a camada de
 * aplicação só carrega `categoryId` (via `CategoryRepository`, que nem
 * devolve nome — só `id`/`active`), quem resolve o nome de verdade é a
 * implementação Prisma via `include: { category: { select: { name: true } } }`
 * (coberta por `mappers.test.ts`). Nenhum teste deste arquivo depende do
 * conteúdo exato desta string.
 */
function fakeCategoryName(categoryId: string): string {
  return `Categoria de teste (${categoryId})`;
}

/** Projeta um `OccurrenceDetail` guardado no fake para o `OccurrenceRecord` que os métodos de escrita devolvem — evita repetir os mesmos 20 campos em `changeStatus`/`updatePriority`/`assignResponsible`. */
function toRecord(detail: OccurrenceDetail): OccurrenceRecord {
  return {
    id: detail.id,
    code: detail.code,
    title: detail.title,
    description: detail.description,
    status: detail.status,
    priority: detail.priority,
    categoryId: detail.categoryId,
    categoryName: detail.categoryName,
    locationLabel: detail.locationLabel,
    latitude: detail.latitude,
    longitude: detail.longitude,
    imageUrl: detail.imageUrl,
    imageKey: detail.imageKey,
    createdById: detail.createdById,
    assignedToId: detail.assignedToId,
    assignedToName: detail.assignedToName,
    resolutionNote: detail.resolutionNote,
    resolvedAt: detail.resolvedAt,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

export type FakeOccurrenceSeed = OccurrenceRecord & {
  history?: StatusHistoryEntry[];
  comments?: CommentEntry[];
  rating?: RatingEntry | null;
};

export interface FakeOccurrenceRepositoryOptions {
  /**
   * Fila FIFO de comportamentos consumida a cada chamada de `create`, para
   * forçar a colisão de `code` descrita em `create-occurrence.ts` (a
   * corrida de dois `POST /occurrences` simultâneos) sem precisar de banco
   * real. Uma vez esgotada, `create` volta ao comportamento normal
   * (detecção de colisão real contra os códigos já guardados).
   */
  createBehaviors?: Array<'ok' | 'conflict'>;
}

/**
 * Repositório fake em memória de `OccurrenceRepository`, compartilhado pelos
 * testes de use-case de `occurrence` (`create-occurrence`, `list-occurrences`,
 * `get-occurrence`, `add-comment`) — nenhum deles toca o Prisma.
 */
export function createInMemoryOccurrenceRepository(
  seed: FakeOccurrenceSeed[] = [],
  options: FakeOccurrenceRepositoryOptions = {},
) {
  const rows = new Map<string, OccurrenceDetail>(
    seed.map((s) => [
      s.id,
      {
        ...s,
        history: s.history ?? [],
        comments: s.comments ?? [],
        rating: s.rating ?? null,
      },
    ]),
  );
  const createBehaviors = [...(options.createBehaviors ?? [])];
  let nextId = seed.length + 1;
  let nextHistoryId = 1;
  let nextCommentId = 1;
  let nextRatingId = 1;

  const repository: OccurrenceRepository = {
    async create(input: CreateOccurrenceData): Promise<OccurrenceRecord> {
      const behavior = createBehaviors.shift();
      if (behavior === 'conflict') {
        throw new OccurrenceCodeConflictError();
      }

      const codeAlreadyUsed = [...rows.values()].some((row) => row.code === input.code);
      if (codeAlreadyUsed) {
        throw new OccurrenceCodeConflictError();
      }

      const now = new Date(FIXED_NOW);
      const record: OccurrenceRecord = {
        id: `occ-${nextId++}`,
        code: input.code,
        title: input.title,
        description: input.description,
        status: 'ABERTA',
        priority: 'MEDIA',
        categoryId: input.categoryId,
        categoryName: fakeCategoryName(input.categoryId),
        locationLabel: input.locationLabel,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        // Simula a derivação real (`prisma-occurrence-repository.ts` +
        // `FileStorage.urlForKey`): a URL nunca vem do input, só a chave —
        // este fake reproduz o formato do storage local por ser o mais
        // simples de montar sem depender de infra.
        imageUrl: input.imageKey ? `/api/v1/uploads/${input.imageKey}` : null,
        imageKey: input.imageKey ?? null,
        createdById: input.createdById,
        assignedToId: null,
        assignedToName: null,
        resolutionNote: null,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      const initialHistory: StatusHistoryEntry = {
        id: `hist-${nextHistoryId++}`,
        fromStatus: null,
        toStatus: 'ABERTA',
        note: null,
        changedById: input.createdById,
        changedByName: fakeName(input.createdById),
        createdAt: now,
      };

      rows.set(record.id, { ...record, history: [initialHistory], comments: [], rating: null });

      return record;
    },

    async list(query: ListOccurrencesQuery): Promise<ListOccurrencesResult> {
      let data = [...rows.values()];

      if (query.status) data = data.filter((o) => o.status === query.status);
      if (query.categoryId) data = data.filter((o) => o.categoryId === query.categoryId);
      if (query.priority) data = data.filter((o) => o.priority === query.priority);
      if (query.assignedToId) data = data.filter((o) => o.assignedToId === query.assignedToId);
      if (query.createdById) data = data.filter((o) => o.createdById === query.createdById);
      if (query.q) {
        const q = query.q.toLowerCase();
        data = data.filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            o.description.toLowerCase().includes(q) ||
            o.code.toLowerCase().includes(q),
        );
      }

      // Mesma ordenação de `buildOrderBy` (`prisma-occurrence-repository.ts`),
      // reproduzida em JS: `priority` usa `priorityWeight` (o fake não tem um
      // enum nativo do Postgres para se apoiar), os demais campos comparam
      // diretamente.
      const direction = query.sortOrder === 'asc' ? 1 : -1;
      data = [...data].sort((a, b) => {
        const cmp =
          query.sortBy === 'priority'
            ? priorityWeight(a.priority) - priorityWeight(b.priority)
            : query.sortBy === 'status'
              ? a.status.localeCompare(b.status)
              : a.createdAt.getTime() - b.createdAt.getTime();

        return cmp * direction;
      });

      const total = data.length;
      const start = (query.page - 1) * query.pageSize;
      const page = data.slice(start, start + query.pageSize);

      const items: OccurrenceListItem[] = page.map((o) => ({
        id: o.id,
        code: o.code,
        title: o.title,
        status: o.status,
        priority: o.priority,
        categoryId: o.categoryId,
        categoryName: o.categoryName,
        locationLabel: o.locationLabel,
        createdById: o.createdById,
        assignedToId: o.assignedToId,
        createdAt: o.createdAt,
      }));

      return { data: items, total };
    },

    async findById(id: string): Promise<OccurrenceDetail | null> {
      const row = rows.get(id);

      return row ? { ...row, history: [...row.history], comments: [...row.comments] } : null;
    },

    async addComment(input: AddCommentData): Promise<CommentEntry> {
      const row = rows.get(input.occurrenceId);
      if (!row) {
        throw new Error(`Ocorrência ${input.occurrenceId} não encontrada no fake`);
      }

      const comment: CommentEntry = {
        id: `comment-${nextCommentId++}`,
        occurrenceId: input.occurrenceId,
        authorId: input.authorId,
        authorName: fakeName(input.authorId),
        body: input.body,
        createdAt: new Date(FIXED_NOW),
      };

      row.comments.push(comment);

      return comment;
    },

    async nextSequenceForYear(year: number): Promise<number> {
      const prefix = `OC-${String(year).padStart(4, '0')}-`;
      const sequences = [...rows.values()]
        .filter((o) => o.code.startsWith(prefix))
        .map((o) => Number.parseInt(o.code.slice(prefix.length), 10))
        .filter((n) => !Number.isNaN(n));

      return sequences.length === 0 ? 1 : Math.max(...sequences) + 1;
    },

    async changeStatus(occurrenceId: string, input: ChangeStatusData): Promise<OccurrenceRecord> {
      const row = rows.get(occurrenceId);
      if (!row) {
        throw new Error(`Ocorrência ${occurrenceId} não encontrada no fake`);
      }

      const now = new Date(FIXED_NOW);

      const updated: OccurrenceDetail = {
        ...row,
        status: input.toStatus,
        // Mesma regra da implementação Prisma: só grava
        // `resolutionNote`/`resolvedAt` quando o destino é `RESOLVIDA`.
        ...(input.toStatus === 'RESOLVIDA'
          ? { resolutionNote: input.resolutionNote ?? null, resolvedAt: now }
          : {}),
        updatedAt: now,
      };

      const historyEntry: StatusHistoryEntry = {
        id: `hist-${nextHistoryId++}`,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        note: input.note ?? null,
        changedById: input.changedById,
        changedByName: fakeName(input.changedById),
        createdAt: now,
      };

      updated.history = [...row.history, historyEntry];

      rows.set(occurrenceId, updated);

      return toRecord(updated);
    },

    async updatePriority(occurrenceId: string, priority: Priority): Promise<OccurrenceRecord> {
      const row = rows.get(occurrenceId);
      if (!row) {
        throw new Error(`Ocorrência ${occurrenceId} não encontrada no fake`);
      }

      const updated: OccurrenceDetail = { ...row, priority, updatedAt: new Date(FIXED_NOW) };
      rows.set(occurrenceId, updated);

      return toRecord(updated);
    },

    async assignResponsible(
      occurrenceId: string,
      userId: string | null,
    ): Promise<OccurrenceRecord> {
      const row = rows.get(occurrenceId);
      if (!row) {
        throw new Error(`Ocorrência ${occurrenceId} não encontrada no fake`);
      }

      const updated: OccurrenceDetail = {
        ...row,
        assignedToId: userId,
        assignedToName: userId ? fakeName(userId) : null,
        updatedAt: new Date(FIXED_NOW),
      };
      rows.set(occurrenceId, updated);

      return toRecord(updated);
    },

    async rate(occurrenceId: string, input: RateOccurrenceData): Promise<RatingEntry> {
      const row = rows.get(occurrenceId);
      if (!row) {
        throw new Error(`Ocorrência ${occurrenceId} não encontrada no fake`);
      }

      // Simula a constraint `@unique` de `Rating.occurrenceId` (mesma
      // proteção que a implementação Prisma traduz de P2002): já existe uma
      // avaliação para esta ocorrência no estado interno do fake.
      if (row.rating) {
        throw new OccurrenceAlreadyRatedError();
      }

      const rating: RatingEntry = {
        id: `rating-${nextRatingId++}`,
        score: input.score,
        comment: input.comment ?? null,
        createdAt: new Date(FIXED_NOW),
      };

      row.rating = rating;

      return rating;
    },
  };

  return { repository, rows };
}
