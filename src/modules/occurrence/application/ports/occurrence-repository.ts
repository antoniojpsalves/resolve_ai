import type { Priority } from '@/modules/occurrence/domain/priority';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

/**
 * Dados necessários para criar uma ocorrência. `code` já vem pronto (gerado
 * pelo use-case via `buildOccurrenceCode` + `nextSequenceForYear`); `status`
 * e `priority` não entram aqui porque são sempre `ABERTA`/`MEDIA` na criação —
 * a implementação fixa os dois valores, não o chamador.
 */
export interface CreateOccurrenceData {
  code: string;
  title: string;
  description: string;
  categoryId: string;
  locationLabel: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  imageKey?: string;
  createdById: string;
}

/**
 * Projeção completa de uma ocorrência para a camada de aplicação — não é o
 * tipo gerado pelo Prisma (esse não sai de `infra/`), nem o `Occurrence`
 * mínimo do domínio (esse só carrega os campos que as regras de permissão e
 * transição precisam). É o formato que use-cases e route handlers devolvem
 * ao cliente HTTP.
 */
export interface OccurrenceRecord {
  id: string;
  code: string;
  title: string;
  description: string;
  status: OccurrenceStatus;
  priority: Priority;
  categoryId: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  imageKey: string | null;
  createdById: string;
  assignedToId: string | null;
  /**
   * `User.name` de `assignedToId`, resolvido pelo repositório (`findById`) —
   * `null` sempre que `assignedToId` for `null`. Existe para a tela de
   * detalhe mostrar quem é o responsável sem expor o `id` bruto (Tarefa 4,
   * rodada de correção 1).
   */
  assignedToName: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Item de listagem — recorte mais leve que `OccurrenceRecord`, sem os campos que a tela de lista não usa. */
export interface OccurrenceListItem {
  id: string;
  code: string;
  title: string;
  status: OccurrenceStatus;
  priority: Priority;
  categoryId: string;
  locationLabel: string;
  createdById: string;
  assignedToId: string | null;
  createdAt: Date;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: OccurrenceStatus | null;
  toStatus: OccurrenceStatus;
  note: string | null;
  changedById: string;
  /**
   * `User.name` de `changedById`, resolvido pelo repositório (`findById`) —
   * sempre presente: `changedBy` é uma relação obrigatória no schema. Existe
   * para a timeline do detalhe mostrar quem agiu sem expor o `id` bruto
   * (Tarefa 4, rodada de correção 1).
   */
  changedByName: string;
  createdAt: Date;
}

export interface CommentEntry {
  id: string;
  occurrenceId: string;
  authorId: string;
  /**
   * `User.name` de `authorId`, resolvido pelo repositório (`findById` e
   * `addComment`) — sempre presente: `author` é uma relação obrigatória no
   * schema. Mesma justificativa de `StatusHistoryEntry.changedByName`.
   */
  authorName: string;
  body: string;
  createdAt: Date;
}

export interface RatingEntry {
  id: string;
  score: number;
  comment: string | null;
  createdAt: Date;
}

/** Detalhe completo: `OccurrenceRecord` mais histórico, comentários e avaliação. */
export interface OccurrenceDetail extends OccurrenceRecord {
  history: StatusHistoryEntry[];
  comments: CommentEntry[];
  rating: RatingEntry | null;
}

/**
 * Filtros e paginação de `list`. `createdById` não é exposto ao cliente HTTP
 * como filtro livre — é o use-case quem o preenche (ou não) de acordo com o
 * papel do ator, para aplicar o recorte por perfil (ver `list-occurrences.ts`).
 */
export interface ListOccurrencesQuery {
  status?: OccurrenceStatus;
  categoryId?: string;
  priority?: Priority;
  q?: string;
  assignedToId?: string;
  createdById?: string;
  page: number;
  pageSize: number;
}

export interface ListOccurrencesResult {
  data: OccurrenceListItem[];
  total: number;
}

export interface AddCommentData {
  occurrenceId: string;
  authorId: string;
  body: string;
}

/**
 * Sinaliza que o `code` calculado por `nextSequenceForYear` + `buildOccurrenceCode`
 * colidiu com um `code` já existente — a corrida descrita em `create-occurrence.ts`.
 * Não é um `AppError`: nunca deve vazar para o cliente HTTP, é consumida
 * internamente pelo retry do use-case. A implementação Prisma a lança
 * traduzindo o `P2002` da constraint `@unique` de `code`, no mesmo padrão que
 * `prisma-user-repository.ts` usa para o e-mail duplicado.
 */
export class OccurrenceCodeConflictError extends Error {
  constructor() {
    super('O código de protocolo calculado já está em uso.');
    this.name = 'OccurrenceCodeConflictError';
  }
}

/**
 * Port de persistência de ocorrências. Os use-cases dependem desta
 * interface, nunca do Prisma — a implementação real vive em
 * `infra/prisma-occurrence-repository.ts`; os testes usam fakes em memória
 * (`tests/helpers/occurrence-repository.ts`).
 */
export interface OccurrenceRepository {
  /**
   * Cria a ocorrência **e** a entrada inicial de `StatusHistory`
   * (`fromStatus: null`, `toStatus: 'ABERTA'`, `changedById: createdById`) na
   * mesma transação — não pode existir ocorrência sem essa entrada.
   */
  create(input: CreateOccurrenceData): Promise<OccurrenceRecord>;
  list(query: ListOccurrencesQuery): Promise<ListOccurrencesResult>;
  findById(id: string): Promise<OccurrenceDetail | null>;
  addComment(input: AddCommentData): Promise<CommentEntry>;
  /** Maior sequência já usada no ano + 1 (ou 1, se nenhuma ocorrência do ano existir). */
  nextSequenceForYear(year: number): Promise<number>;
}
