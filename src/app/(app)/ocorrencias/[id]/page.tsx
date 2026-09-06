import { notFound } from 'next/navigation';

import { PriorityBadge } from '@/components/occurrences/priority-badge';
import { StatusBadge } from '@/components/occurrences/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { NotFoundError } from '@/core/errors';
import { requireSessionOrRedirect } from '@/core/http/auth-guards';
import { formatDateTime } from '@/lib/occurrences/date';
import { statusLabel } from '@/lib/occurrences/status';
import { buildTimeline } from '@/lib/occurrences/timeline';
import { getOccurrence } from '@/modules/occurrence/application/get-occurrence';
import { listCategories } from '@/modules/occurrence/application/list-categories';
import type { OccurrenceDetail } from '@/modules/occurrence/application/ports/occurrence-repository';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { prismaCategoryRepository } from '@/modules/occurrence/infra/prisma-category-repository';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

import { CommentForm } from './comment-form';

interface OcorrenciaDetalhePageProps {
  params: Promise<{ id: string }>;
}

async function fetchDetail(id: string, actor: Actor): Promise<OccurrenceDetail> {
  try {
    return await getOccurrence(id, actor, { occurrences: prismaOccurrenceRepository });
  } catch (error) {
    // Mesmo 404 uniforme do use-case para "não existe" e "existe mas não é
    // sua" — a tela (`not-found.tsx` deste segmento) não distingue os dois
    // casos, de propósito (item do brief).
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }
}

/**
 * Quem apareceu numa entrada de histórico ou num comentário. `findById`
 * (`prisma-occurrence-repository.ts`) resolve o nome real (`User.name`) via
 * `changedBy`/`author`, então o caminho normal mostra a pessoa — nunca um
 * rótulo genérico nem o `id` bruto (rodada de correção 1 da Tarefa 4).
 *
 * Decisão registrada no relatório: quando o ator logado é quem agiu,
 * mostramos "Você" em vez do próprio nome (convenção comum em timelines/chat
 * — o usuário não precisa se identificar para si mesmo); para qualquer outra
 * pessoa, mostramos o nome real. `name` é sempre uma string não vazia vinda
 * do banco (`User.name` é obrigatório no schema), mas o fallback abaixo
 * cobre um valor vazio sem nunca cair para o `id`.
 */
function describeActor(userId: string, name: string, actorId: string): string {
  if (userId === actorId) {
    return 'Você';
  }

  return name.trim() || 'Membro da equipe';
}

export default async function OcorrenciaDetalhePage({ params }: OcorrenciaDetalhePageProps) {
  const session = await requireSessionOrRedirect();
  const actor: Actor = { id: session.user.id, role: session.user.role };
  const { id } = await params;

  const [detail, categories] = await Promise.all([
    fetchDetail(id, actor),
    listCategories({ categories: prismaCategoryRepository }),
  ]);

  const category = categories.find((item) => item.id === detail.categoryId);
  const timeline = buildTimeline(detail.history);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-muted-foreground font-mono text-sm">{detail.code}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{detail.title}</h1>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={detail.status} />
          <PriorityBadge priority={detail.priority} />
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Descrição
            </p>
            <p className="text-sm whitespace-pre-wrap">{detail.description}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Categoria
            </p>
            <p className="text-sm">{category?.name ?? 'Categoria removida'}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Localização
            </p>
            <p className="text-sm">{detail.locationLabel}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Aberta em
            </p>
            <p className="text-sm">{formatDateTime(detail.createdAt)}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Responsável
            </p>
            <p className="text-sm">{detail.assignedToName ?? 'Ainda não atribuído'}</p>
          </div>

          {detail.resolutionNote ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Solução registrada
              </p>
              <p className="text-sm whitespace-pre-wrap">{detail.resolutionNote}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {detail.imageUrl ? (
        <Card>
          <CardContent>
            {/* `<img>` simples: o navegador manda o cookie de sessão numa requisição de mesma origem — GET /api/v1/uploads/[key] exige sessão e funciona sem tratamento especial. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={detail.imageUrl}
              alt={`Imagem enviada com a ocorrência ${detail.code}: ${detail.title}`}
              className="max-h-96 w-full rounded-md border object-contain"
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">Histórico</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {timeline.map((entry) => (
              <li key={entry.id} className="border-border border-l-2 py-0.5 pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.isOpening ? (
                    <Badge variant="outline">Abertura</Badge>
                  ) : (
                    <StatusBadge status={entry.toStatus} />
                  )}
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  {entry.isOpening
                    ? `Ocorrência aberta por ${describeActor(entry.changedById, entry.changedByName, actor.id)}`
                    : `${describeActor(entry.changedById, entry.changedByName, actor.id)} alterou o status para ${statusLabel(entry.toStatus)}`}
                </p>
                {entry.note ? (
                  <p className="text-muted-foreground mt-1 text-sm italic">“{entry.note}”</p>
                ) : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">Comentários</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum comentário ainda.</p>
          ) : (
            <ul className="space-y-3">
              {detail.comments.map((comment) => (
                <li key={comment.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {describeActor(comment.authorId, comment.authorName, actor.id)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <CommentForm occurrenceId={detail.id} />
        </CardContent>
      </Card>
    </section>
  );
}
