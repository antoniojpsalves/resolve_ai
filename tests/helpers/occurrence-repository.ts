import {
  OccurrenceCodeConflictError,
  type AddCommentData,
  type CommentEntry,
  type CreateOccurrenceData,
  type ListOccurrencesQuery,
  type ListOccurrencesResult,
  type OccurrenceDetail,
  type OccurrenceListItem,
  type OccurrenceRecord,
  type OccurrenceRepository,
  type RatingEntry,
  type StatusHistoryEntry,
} from '@/modules/occurrence/application/ports/occurrence-repository';

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

      data = [...data].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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
  };

  return { repository, rows };
}
