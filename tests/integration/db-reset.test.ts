import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/core/db/prisma';

import { resetDatabase } from './helpers/db';
import { createFixtureUser } from './helpers/fixtures';

/**
 * Valida a infra de teste de integração em si (Parte A do brief): o
 * redirecionamento de `DATABASE_URL` via `tests/integration/setup.ts` está
 * ativo (senão `resetDatabase()` recusaria rodar, ver guarda abaixo), o
 * `beforeEach` limpa o banco entre casos (sem vazamento) e a guarda contra
 * rodar fora de um banco `_test` funciona.
 */
describe('resetDatabase (infra de teste de integração)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('recusa truncar um banco cujo nome não contém "_test"', async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      'postgresql://resolve:resolve@localhost:5432/resolve_ai?schema=public';

    try {
      await expect(resetDatabase()).rejects.toThrow(/_test/);
    } finally {
      process.env.DATABASE_URL = original;
    }
  });

  it('limpa as tabelas de domínio entre um teste e o próximo (sem vazamento)', async () => {
    expect(await prisma.user.count()).toBe(0);

    await createFixtureUser();

    expect(await prisma.user.count()).toBe(1);
  });

  it('começa vazio de novo no próximo teste — prova de que o beforeEach anterior rodou', async () => {
    expect(await prisma.user.count()).toBe(0);
  });
});
