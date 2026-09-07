import { ArrowLeft, Star } from 'lucide-react';
import Link from 'next/link';
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
import { listManagers } from '@/modules/identity/application/list-managers';
import { prismaUserRepository } from '@/modules/identity/infra/prisma-user-repository';
import { getOccurrence } from '@/modules/occurrence/application/get-occurrence';
import type { OccurrenceDetail } from '@/modules/occurrence/application/ports/occurrence-repository';
import { toDomainOccurrence } from '@/modules/occurrence/application/to-domain-occurrence';
import type { Actor } from '@/modules/occurrence/domain/occurrence';
import { candidateTransitions } from '@/modules/occurrence/domain/transitions';
import { prismaOccurrenceRepository } from '@/modules/occurrence/infra/prisma-occurrence-repository';

import { CommentForm } from './comment-form';
import { ManagementPanel } from './management-panel';
import { RatingForm } from './rating-form';
import { StatusTransitionPanel } from './status-transition-panel';

interface OcorrenciaDetalhePageProps {
  params: Promise<{ id: string }>;
}

async function fetchDetail(id: string, actor: Actor): Promise<OccurrenceDetail> {
  try {
    return await getOccurrence(id, actor, { occurrences: prismaOccurrenceRepository });
  } catch (error) {
    // Mesmo 404 uniforme do use-case para "não existe" e "existe mas não é
    // sua" — a tela (`not-found.tsx` deste segmento) não distingue os dois
    // casos, de propósito: um 403 aqui confirmaria a quem não deveria saber
    // que a ocorrência existe (ver ADR 005).
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
 * rótulo genérico nem o `id` bruto.
 *
 * Quando o ator logado é quem agiu, mostramos "Você" em vez do próprio nome
 * (convenção comum em timelines/chat — o usuário não precisa se identificar
 * para si mesmo); para qualquer outra pessoa, mostramos o nome real. `name`
 * é sempre uma string não vazia vinda do banco (`User.name` é obrigatório no
 * schema), mas o fallback abaixo cobre um valor vazio sem nunca cair para o
 * `id`.
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

  // `listManagers` só é buscado para o gestor (é o único papel que vê
  // `ManagementPanel`) — em paralelo com `fetchDetail`, mesmo padrão de
  // `ocorrencias/page.tsx` buscando `listOccurrences`+`listCategories` juntos.
  const [detail, managers] = await Promise.all([
    fetchDetail(id, actor),
    actor.role === 'GESTOR' ? listManagers({ users: prismaUserRepository }) : Promise.resolve([]),
  ]);

  const timeline = buildTimeline(detail.history);
  const candidates = candidateTransitions(actor, toDomainOccurrence(detail));
  const canRate =
    actor.id === detail.createdById && detail.status === 'RESOLVIDA' && detail.rating === null;

  return (
    <section className="space-y-6">
      <Link
        href="/ocorrencias"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar para a lista
      </Link>

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
            <p className="text-sm">{detail.categoryName}</p>
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

      <StatusTransitionPanel occurrenceId={detail.id} candidates={candidates} />

      {actor.role === 'GESTOR' ? (
        <ManagementPanel
          occurrenceId={detail.id}
          currentPriority={detail.priority}
          currentAssignedToId={detail.assignedToId}
          managers={managers}
        />
      ) : null}

      {detail.rating !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg font-semibold">Avaliação</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-1" aria-hidden>
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  className={
                    value <= detail.rating!.score
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground'
                  }
                />
              ))}
            </div>
            <p className="sr-only">{detail.rating.score} de 5 estrelas</p>
            {detail.rating.comment ? (
              <p className="text-sm whitespace-pre-wrap">{detail.rating.comment}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : canRate ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg font-semibold">Avaliar atendimento</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RatingForm occurrenceId={detail.id} />
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
