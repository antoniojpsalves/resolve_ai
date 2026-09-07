import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import { prismaUserRepository } from '@/modules/identity/infra/prisma-user-repository';
import { assignOccurrenceResponsible } from '@/modules/occurrence/application/assign-occurrence-responsible';
import { getOccurrence } from '@/modules/occurrence/application/get-occurrence';
import type { OccurrenceRecord } from '@/modules/occurrence/application/ports/occurrence-repository';
import { updateOccurrenceManagementSchema } from '@/modules/occurrence/application/update-occurrence-management';
import { updateOccurrencePriority } from '@/modules/occurrence/application/update-occurrence-priority';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * `GET /api/v1/occurrences/[id]` — detalhe com histórico, comentários e
 * avaliação.
 *
 * Ocorrência inexistente e ocorrência de outra pessoa (para um solicitante)
 * chegam ao cliente como o mesmo 404 — decisão do use-case
 * (`get-occurrence.ts`), não desta rota.
 */
export const GET = route(async (_request: Request, { params }: RouteContext) => {
  const session = await requireSession();
  const actor: Actor = { id: session.user.id, role: session.user.role };
  const { id } = await params;

  const detail = await getOccurrence(id, actor, { occurrences: prismaOccurrenceRepository });

  return Response.json(detail);
});

/**
 * `PATCH /api/v1/occurrences/[id]` — gestão de uma ocorrência pelo gestor:
 * mudar `priority` e/ou atribuir/desatribuir `assignedToId`. Não é uma
 * transição de status (isso é `POST .../status`, Tarefa 1) — os dois campos
 * são independentes um do outro e cada um dispara seu próprio use-case
 * (`updateOccurrencePriority`/`assignOccurrenceResponsible`), por isso não há
 * um único schema "PATCH" no sentido de um único use-case.
 *
 * Quando os dois campos vêm juntos no mesmo `PATCH`, as duas chamadas rodam
 * em sequência — a segunda já lê o valor gravado pela primeira, então
 * `record` (a resposta) reflete as duas mudanças. Sem transação combinando
 * as duas: cada `UPDATE` já é atômico sozinho, e não há invariante que exija
 * que as duas mudanças aconteçam-ou-nenhuma.
 */
export const PATCH = route(async (request: Request, { params }: RouteContext) => {
  const session = await requireSession();
  const actor: Actor = { id: session.user.id, role: session.user.role };
  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  const input = updateOccurrenceManagementSchema.parse(body);

  let record: OccurrenceRecord | null = null;

  // Comparação explícita com `undefined` — nunca `in` — porque o Zod pode
  // materializar a chave no objeto de saída com valor `undefined` mesmo
  // quando ela não veio no JSON de entrada (ver `update-occurrence-management.ts`).
  if (input.priority !== undefined) {
    record = await updateOccurrencePriority(id, actor, input.priority, {
      occurrences: prismaOccurrenceRepository,
    });
  }

  if (input.assignedToId !== undefined) {
    record = await assignOccurrenceResponsible(id, actor, input.assignedToId, {
      occurrences: prismaOccurrenceRepository,
      users: prismaUserRepository,
    });
  }

  // O `.refine` do schema garante que pelo menos um dos dois `if` roda, então
  // `record` nunca chega aqui `null` — mas o TypeScript não sabe disso a
  // partir do fluxo condicional. Guarda explícita em vez de um cast, para não
  // silenciar um bug real se essa invariante for quebrada no futuro.
  if (!record) {
    throw new Error(
      'PATCH /occurrences/[id]: nenhum campo aplicado apesar da validação do schema.',
    );
  }

  return Response.json(record);
});
