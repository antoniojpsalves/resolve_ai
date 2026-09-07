import { config as loadDotenv } from 'dotenv';

/**
 * Setup global do Vitest (`test.setupFiles` em `vitest.config.ts` — roda
 * antes de qualquer arquivo de teste, unitário ou de integração).
 *
 * Diferente do Next.js, o Vitest não carrega `.env` sozinho — por isso o
 * primeiro passo aqui é `loadDotenv()` (pacote `dotenv`, já transitivo via
 * Prisma; declarado como devDependency direta por clareza). `override: false`
 * (padrão): se a variável já existir no ambiente (ex.: exportada manualmente
 * no shell, ou o `env:` do CI), o valor do `.env` não a sobrescreve.
 *
 * Em seguida, redireciona `DATABASE_URL` para `DATABASE_URL_TEST`
 * **antes** de qualquer import que instancie o Prisma Client
 * (`src/core/db/prisma.ts` lê `DATABASE_URL` do `env` no momento em que
 * `new PrismaClient()` roda) — por isso este arquivo precisa ser um
 * `setupFiles`, carregado antes dos arquivos de teste, e não algo importado
 * de dentro de um `beforeAll`.
 *
 * Só sobrescreve quando `DATABASE_URL_TEST` está definida:
 *  - localmente, o dev copia `.env.example` para `.env`, que já define as
 *    duas — `DATABASE_URL` (porta 5432, banco de dev com dados de seed) e
 *    `DATABASE_URL_TEST` (porta 5433, banco `db-test` do `docker-compose.yml`).
 *    Sem este redirecionamento, `npm test` bateria contra o banco de dev por
 *    engano.
 *  - no CI (`.github/workflows/ci.yml`, job `test`), não existe `.env` no
 *    checkout e só `DATABASE_URL` é definida via `env:` do workflow
 *    (apontando direto para o Postgres de serviço, já com o nome
 *    `resolve_ai_test`) — `loadDotenv()` não encontra arquivo (não é erro,
 *    só não define nada) e `DATABASE_URL_TEST` nunca existe lá, então este
 *    `if` não dispara e nada muda no comportamento do CI.
 *
 * Inofensivo para os testes unitários (`tests/unit/**`): eles usam os fakes
 * em memória de `tests/helpers/`, nunca importam `@/core/db/prisma` — a
 * troca de `DATABASE_URL` não tem nenhum efeito neles.
 */
loadDotenv();

if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}
