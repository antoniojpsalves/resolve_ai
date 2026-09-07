import type { Priority } from '@/modules/occurrence/domain/priority';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

/**
 * Dados necessários para criar uma ocorrência. `code` já vem pronto (gerado
 * pelo use-case via `buildOccurrenceCode` + `nextSequenceForYear`); `status`
 * e `priority` não entram aqui porque são sempre `ABERTA`/`MEDIA` na criação —
 * a implementação fixa os dois valores, não o chamador.
 *
 * Sem `imageUrl` de propósito: só `imageKey` (validada com `isValidUploadKey`
 * pelo use-case) chega até aqui. A URL de leitura nunca é recebida do
 * cliente nem gravada — é derivada de `imageKey` pelo `FileStorage` ativo no
 * momento da leitura (ver `OccurrenceRecord.imageUrl` e
 * `infra/prisma-occurrence-repository.ts`).
 */
export interface CreateOccurrenceData {
  code: string;
  title: string;
  description: string;
  categoryId: string;
  locationLabel: string;
  latitude?: number;
  longitude?: number;
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
  /**
   * `Category.name` resolvido via `include: { category: { select: { name: true } } }`
   * pelo repositório — nunca buscado à parte (ver `listCategories` só serve
   * o `<Select>` de filtro/formulário, não a resolução de nome). Sempre
   * presente: `category` é relação obrigatória no schema, e o join não filtra
   * por `active` — uma ocorrência cuja categoria foi desativada depois
   * continua mostrando o nome histórico, em vez de "Categoria removida".
   */
  categoryName: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  /**
   * Derivada de `imageKey` pelo `FileStorage` ativo no momento da leitura —
   * nunca lida de uma coluna gravada no banco (ver `CreateOccurrenceData`).
   * `null` quando não há `imageKey`.
   */
  imageUrl: string | null;
  imageKey: string | null;
  createdById: string;
  assignedToId: string | null;
  /**
   * `User.name` de `assignedToId`, resolvido pelo repositório (`findById`) —
   * `null` sempre que `assignedToId` for `null`. Existe para a tela de
   * detalhe mostrar quem é o responsável sem expor o `id` bruto.
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
  /** Mesma resolução de `OccurrenceRecord.categoryName` — ver o comentário lá. */
  categoryName: string;
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
   * para a timeline do detalhe mostrar quem agiu sem expor o `id` bruto.
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
  sortBy: 'createdAt' | 'priority' | 'status';
  sortOrder: 'asc' | 'desc';
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
 * Dados para `changeStatus`. `toStatus` já veio validado por `canTransition`
 * (o use-case `change-occurrence-status.ts` só chama o repositório quando
 * `allowed: true`) — esta porta não repete a validação de transição, só
 * persiste o resultado.
 *
 * Inclui `fromStatus`, além dos quatro campos do enunciado da tarefa: o
 * use-case já carregou o `OccurrenceDetail` para checar `canTransition` e
 * sabe o status atual — pedir para o repositório reler a linha dentro da
 * transação só para descobrir o `fromStatus` seria uma consulta extra sem
 * necessidade, e a implementação precisa desse valor para gravar
 * `StatusHistory.fromStatus` (não existe "ler de volta do UPDATE": o Prisma
 * não expõe o valor anterior da linha, só o que ficou depois de atualizar).
 * Esta é a opção "receber `from` explícito" mencionada como preferida na
 * tarefa — mantém a porta simétrica ao que o use-case já validou, em vez de
 * reler dentro da transação.
 */
export interface ChangeStatusData {
  fromStatus: OccurrenceStatus;
  toStatus: OccurrenceStatus;
  note?: string;
  resolutionNote?: string;
  changedById: string;
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
  /**
   * Atualiza `status` (e `resolutionNote`/`resolvedAt` quando o destino é
   * `RESOLVIDA`) e insere a entrada de `StatusHistory` correspondente na
   * mesma transação — mesma garantia de `create()`: não pode existir mudança
   * de status sem a entrada de auditoria.
   */
  changeStatus(occurrenceId: string, input: ChangeStatusData): Promise<OccurrenceRecord>;
  /** Atualiza só `priority`. Não toca em `status`/`assignedToId`/histórico. */
  updatePriority(occurrenceId: string, priority: Priority): Promise<OccurrenceRecord>;
  /**
   * Atualiza só `assignedToId` — `null` desatribui. Não toca em
   * `status`/`priority`/histórico: atribuir responsável não é uma transição
   * de status e não gera entrada em `StatusHistory` (o plano não pede isso;
   * se quiser registrar "quem atribuiu quem" mais tarde, é decisão de um dia
   * futuro, não desta tarefa).
   */
  assignResponsible(occurrenceId: string, userId: string | null): Promise<OccurrenceRecord>;
}
