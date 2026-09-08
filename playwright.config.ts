import { defineConfig, devices } from '@playwright/test';

/**
 * Valores de partida para quem roda `npm run test:e2e` localmente sem
 * exportar nada no shell — mesmo espírito do `AUTH_SECRET` fixo dos jobs
 * `quality`/`test` do CI (`ci-test-secret-nao-usar-em-producao`). Em CI, o
 * job `e2e` (`.github/workflows/ci.yml`) já define `AUTH_SECRET`/`DATABASE_URL`
 * no nível do job — como o `env` abaixo é aplicado por cima de `process.env`
 * (Playwright estende, não substitui), essas variáveis vencem os fallbacks
 * automaticamente lá, sem duplicar valor nenhum entre os dois arquivos.
 * Localmente, o fallback aponta para o `db-test` do `docker-compose.yml`
 * (porta 5433) — não para o Postgres de desenvolvimento (`db`, porta 5432).
 */
const DEFAULT_E2E_AUTH_SECRET = 'ci-test-secret-nao-usar-em-producao';
const DEFAULT_E2E_DATABASE_URL =
  'postgresql://resolve:resolve@localhost:5433/resolve_ai_test?schema=public';

export default defineConfig({
  testDir: './tests/e2e',
  // `true` no nível do arquivo/config: os únicos dois arquivos e2e hoje
  // (`home.spec.ts` e `journeys.spec.ts`) não compartilham estado entre si,
  // então continuam livres para rodar em paralelo. O isolamento que importa
  // é *dentro* de `journeys.spec.ts`, garantido por `test.describe.serial`
  // (mesmo worker, ordem declarada, para no primeiro teste que falhar) — não
  // por `workers: 1` global, que penalizaria toda a suíte à toa.
  //
  // Atenção, autor de um futuro arquivo e2e: `fullyParallel: true` roda
  // arquivos diferentes em paralelo, contra o mesmo Postgres não resetado
  // entre eles (ver `webServer`/`DEFAULT_E2E_DATABASE_URL` abaixo). Um novo
  // spec que toque dados de negócio (crie/edite ocorrências, usuários etc.)
  // vai competir por esses mesmos dados com `journeys.spec.ts` a menos que
  // também seja serializado internamente (`test.describe.serial`, como aqui)
  // ou auto-isolado (fixtures próprias, dados com identificador único por
  // execução) — sem isso, a mesma classe de corrida de dados volta.
  fullyParallel: true,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  // Jornada 2 encadeia upload de imagem, criação de ocorrência e várias
  // transições de status contra Postgres real — folga um pouco maior que o
  // padrão (5s) para cada `expect(...)` web-first não confundir latência
  // real (rede/DB/disco) com um bug.
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // `next start` de uma build de produção pode demorar mais que o timeout
    // padrão do Playwright (60s), principalmente em CI — 120s dá folga sem
    // mascarar uma app que realmente não sobe.
    timeout: 120_000,
    // Explícito e não herdado do shell: sem isto, o servidor sobe usando
    // qualquer `AUTH_SECRET`/`DATABASE_URL` que por acaso esteja no
    // ambiente do processo pai — funciona local (quem já tem `.env`
    // exportado) e falha em CI (sem `.env`, sem essas variáveis).
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? DEFAULT_E2E_AUTH_SECRET,
      DATABASE_URL: process.env.DATABASE_URL ?? DEFAULT_E2E_DATABASE_URL,
    },
  },
});
