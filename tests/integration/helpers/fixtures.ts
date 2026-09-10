import type { Category, Occurrence, User } from '@prisma/client';

import { prisma } from '@/core/db/prisma';
import type { Role } from '@/modules/identity/domain/role';
import { buildOccurrenceCode } from '@/modules/occurrence/domain/protocol';
import type { Priority } from '@/modules/occurrence/domain/priority';
import type { OccurrenceStatus } from '@/modules/occurrence/domain/status';

/**
 * Fixtures mínimas para testes de integração (Postgres real via
 * `tests/integration/helpers/db.ts`), compartilhadas por todos os testes de
 * integração sobre ocorrência/usuário/categoria. Não usa `prisma/seed.ts` de
 * propósito — seed é para dados de demonstração, não fixture determinística de
 * teste.
 *
 * Nenhuma senha real é necessária aqui: esses testes constroem o
 * `Actor` à mão em vez de autenticar via NextAuth (ver
 * `tests/integration/occurrences-status.test.ts`), então `passwordHash` é só
 * um placeholder óbvio, nunca comparado por `verifyPassword`.
 */

let counter = 0;

/** Contador monotônico simples para gerar e-mails/códigos/slugs únicos por teste. */
function nextId(): number {
  counter += 1;
  return counter;
}

export interface CreateFixtureUserInput {
  name?: string;
  email?: string;
  role?: Role;
}

export async function createFixtureUser(input: CreateFixtureUserInput = {}): Promise<User> {
  const n = nextId();

  return prisma.user.create({
    data: {
      name: input.name ?? `Usuário Fixture ${n}`,
      email: input.email ?? `fixture-user-${n}@example.com`,
      passwordHash: 'fixture-hash-nao-e-uma-senha-real',
      role: input.role ?? 'SOLICITANTE',
    },
  });
}

export interface CreateFixtureCategoryInput {
  name?: string;
  slug?: string;
  active?: boolean;
}

export async function createFixtureCategory(
  input: CreateFixtureCategoryInput = {},
): Promise<Category> {
  const n = nextId();

  return prisma.category.create({
    data: {
      name: input.name ?? `Categoria Fixture ${n}`,
      slug: input.slug ?? `categoria-fixture-${n}`,
      active: input.active ?? true,
    },
  });
}

export interface CreateFixtureOccurrenceInput {
  createdById: string;
  categoryId: string;
  code?: string;
  title?: string;
  description?: string;
  locationLabel?: string;
  status?: OccurrenceStatus;
  priority?: Priority;
  assignedToId?: string;
  resolutionNote?: string;
  resolvedAt?: Date;
}

/**
 * Cria a ocorrência **e** a entrada inicial de `StatusHistory` na mesma
 * transação — mesma garantia de `prismaOccurrenceRepository.create()` (ver
 * `src/modules/occurrence/infra/prisma-occurrence-repository.ts`): não existe
 * ocorrência de fixture sem a entrada de auditoria correspondente.
 */
export async function createFixtureOccurrence(
  input: CreateFixtureOccurrenceInput,
): Promise<Occurrence> {
  const n = nextId();
  const status = input.status ?? 'ABERTA';

  return prisma.$transaction(async (tx) => {
    const occurrence = await tx.occurrence.create({
      data: {
        code: input.code ?? buildOccurrenceCode(2026, n),
        title: input.title ?? `Ocorrência fixture ${n}`,
        description: input.description ?? 'Descrição gerada para teste de integração.',
        categoryId: input.categoryId,
        locationLabel: input.locationLabel ?? 'Bloco fixture, andar 1',
        createdById: input.createdById,
        assignedToId: input.assignedToId,
        resolutionNote: input.resolutionNote,
        resolvedAt: input.resolvedAt,
        status,
        priority: input.priority ?? 'MEDIA',
      },
    });

    await tx.statusHistory.create({
      data: {
        occurrenceId: occurrence.id,
        fromStatus: null,
        toStatus: status,
        changedById: input.createdById,
      },
    });

    return occurrence;
  });
}
