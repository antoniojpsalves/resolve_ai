import { prisma } from '@/core/db/prisma';

/**
 * `TRUNCATE ... CASCADE` sobre todas as tabelas de domínio, entre um teste de
 * integração e o próximo. `CASCADE` dispensa se preocupar com ordem de FK
 * (`Rating`/`Comment`/`StatusHistory` referenciam `Occurrence`, que referencia
 * `Category`/`User`) — uma query só, sem `deleteMany` encadeado.
 * `RESTART IDENTITY` não tem efeito aqui (todas as PKs são `cuid()`, não
 * sequência), mas mantém a intenção explícita caso alguma tabela futura passe
 * a usar `autoincrement()`.
 *
 * Guarda: só executa se `DATABASE_URL` apontar para um banco cujo nome
 * contenha `_test` — recusa rodar contra o banco de dev (`resolve_ai`, sem o
 * sufixo) por engano. Cobre tanto o nome local (`resolve_ai_test`, de
 * `.env.example`) quanto o do CI (também `resolve_ai_test`,
 * `.github/workflows/ci.yml`).
 */
export async function resetDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const databaseName = databaseUrl.split('?')[0]?.split('/').pop() ?? '';

  if (!databaseName.includes('_test')) {
    throw new Error(
      `resetDatabase(): recusando truncar "${databaseName || '(vazio)'}" — o nome do banco não contém "_test". ` +
        'Confirme que DATABASE_URL_TEST está definida (ver tests/integration/setup.ts) antes de rodar testes de integração.',
    );
  }

  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Rating", "Comment", "StatusHistory", "Occurrence", "Category", "User" RESTART IDENTITY CASCADE;',
  );
}
