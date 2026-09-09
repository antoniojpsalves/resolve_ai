# Resolve Aí

Plataforma de gestão de ocorrências (ex.: manutenção predial/condomínio, service desk
interno) com dois papéis: **Solicitante**, que abre uma ocorrência (título, descrição,
categoria, localização e foto opcional) e acompanha o andamento; e **Gestor**, que faz a
triagem, prioriza, atribui responsável e conduz a ocorrência pela máquina de estados
`ABERTA → EM_ANALISE → EM_ATENDIMENTO → RESOLVIDA` (ou `CANCELADA` em qualquer ponto
antes de `RESOLVIDA`), sempre com observação obrigatória e um registro de histórico
auditável a cada transição — quem mudou o quê e quando. Depois de `RESOLVIDA`, o próprio
solicitante avalia com nota (1–5 estrelas) e comentário opcional. O Gestor tem também um
dashboard com indicadores agregados (por status, categoria, prioridade, tempo médio de
resolução, série temporal de abertura×resolução).

Um roteiro guiado desse fluxo completo (com o que mostrar em cada tela) está em
[`docs/apresentacao.md`](./docs/apresentacao.md) — útil tanto para gravar uma
demonstração quanto para navegar o produto rapidamente sem ler código.

## Stack

- **Framework:** Next.js 15 (App Router, fullstack — front-end e API na mesma
  aplicação)
- **Linguagem:** TypeScript
- **Estilo/UI:** Tailwind CSS + shadcn/ui (estilo `new-york`, cor base `slate`)
- **Banco de dados:** PostgreSQL
- **ORM:** Prisma (schema, migrations e seed determinístico já entregues)
- **Autenticação:** NextAuth (Auth.js v5, provider Credentials, sessão JWT)
- **Testes:** Vitest (unitário/integração) + Playwright (e2e)
- **Deploy:** Vercel (aplicação) + Neon (Postgres gerenciado) + Vercel Blob (imagens) —
  ver ADR [006](./docs/adr/006-vercel-nao-docker-producao.md); infraestrutura e
  checklist prontos (seção "Deploy" abaixo), URL pública ainda pendente do deploy real
  pelo usuário (ver seção "Ambiente público" ao final e item 8 da matriz de
  rastreabilidade)

## Matriz de rastreabilidade

Régua de "o que o enunciado pede" → "o que existe hoje no repositório", conferida
linha a linha contra o código no Dia 5 (Tarefa 3 preencheu a matriz; a Tarefa 4 fechou
os itens 1 e 9, que a Tarefa 3 havia deixado como pendentes) — não é o que foi
planejado em `docs/PLANO.md`, é o estado real. Nada nesta tabela é considerado
pronto sem a coluna "onde comprova" apontar para um arquivo/rota real.

| #   | Exigência do enunciado  | Como atendemos                                                                                                                                        | Onde comprova                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Arquitetura de software | Camadas `domain`/`application`/`infra` por módulo; dependency inversion nos repositórios (ports + Prisma na `infra`)                                  | `src/modules/occurrence/{domain,application,infra}/`, `src/modules/identity/{domain,application,infra}/`, `docs/adr/001` a `006` (ver seção "Arquitetura" abaixo). Diagrama C4 (contexto/container + camadas) em [`docs/arquitetura.md`](./docs/arquitetura.md), renderizado e conferido — Tarefa 4, Dia 5.                                                       |
| 2   | Backend                 | Route Handlers do Next.js como camada de transporte só; use-cases isolados; validação Zod colocalizada com o use-case                                 | `src/app/api/v1/**/route.ts` (13 rotas — `find src/app/api -name route.ts`), `src/modules/*/application/*.ts` (schema Zod + use-case no mesmo arquivo, ex. `create-occurrence.ts`)                                                                                                                                                                                |
| 3   | APIs                    | REST versionada `/api/v1`; contrato OpenAPI 3.1 **gerado** dos schemas Zod já existentes (não escrito à mão) — Tarefa 3, Dia 5                        | `/api/docs` (UI Scalar, `src/app/api/docs/route.ts`) + `openapi.json` (raiz do repo, gerado por `npm run openapi:generate` → `scripts/generate-openapi.ts`) + registro em `src/core/openapi/`. Validado com `@apidevtools/swagger-parser` e `npx @redocly/cli lint` — ver `docs/sdd/dia-05/tarefa-3-relatorio.md` (fora deste repo) para a evidência de execução. |
| 4   | Banco de dados          | PostgreSQL, migrations versionadas, seed determinístico                                                                                               | `prisma/schema.prisma`, `prisma/migrations/20260904192051_init/`, `prisma/seed.ts`, DER em `docs/der.md`                                                                                                                                                                                                                                                          |
| 5   | Frontend                | App Router + Server Components; Tailwind + shadcn/ui; responsivo e com varredura automatizada de acessibilidade                                       | `src/app/(app)/**`, `src/app/(auth)/**`, `src/components/ui/**` (shadcn); responsivo — commit `fix(layout): corrige overflow horizontal do header em mobile (375px)`; acessível — `tests/e2e/accessibility.spec.ts` (axe-core, `wcag2a`+`wcag2aa`)                                                                                                                |
| 6   | Testes                  | Unit (Vitest) + integração de API (Vitest + Postgres real) + e2e (Playwright)                                                                         | `tests/unit/**` (34 arquivos), `tests/integration/**` (5 arquivos, banco Postgres real), `tests/e2e/**` (3 specs) — `npm test` roda 406 testes (todos verdes nesta tarefa); cobertura e `playwright-report/` são publicados como artifact dos jobs `test`/`e2e` do CI (`.github/workflows/ci.yml`), não commitados (`.gitignore`)                                 |
| 7   | Docker                  | `docker-compose.yml` (Postgres + app + banco de testes, um comando) + `Dockerfile` multi-stage (`output: 'standalone'`) validado no CI                | `docker-compose.yml`, `Dockerfile`, job `docker` de `.github/workflows/ci.yml` (build da imagem + smoke test de `/api/v1/health`, `/` e login sem `500 UntrustedHost`, a cada PR)                                                                                                                                                                                 |
| 8   | Deploy em Cloud         | Vercel (app) + Neon (Postgres) + Vercel Blob (imagens) — infraestrutura e checklist prontos; deploy real é passo manual do usuário, fora desta sessão | `vercel.json`, seção "Deploy (Vercel + Neon + Blob)" deste README (checklist completo de variáveis e passos). URL pública e preview por PR: **pendente** — depende do usuário conectar o projeto na Vercel                                                                                                                                                        |
| 9   | Documentação            | README, ADRs (001 a 006, sem buraco na numeração), DER, diagrama C4, contrato OpenAPI, guia de execução local, roteiro de apresentação                | `README.md`, `docs/adr/001` a `006-*.md`, `docs/arquitetura.md`, `docs/der.md`, `/api/docs` + `openapi.json` (item 3), `docs/apresentacao.md`                                                                                                                                                                                                                     |

**Sobre Docker + Vercel** (o `docs/PLANO.md` original já antecipava que isso precisa
estar explícito): a Vercel **não executa o `Dockerfile`** deste projeto —
`vercel.json` (acima) só declara um `buildCommand` (`prisma migrate deploy && npm run
build`), a Vercel builda com o próprio pipeline do Next.js, sem tocar na imagem
Docker. O Docker cumpre dois papéis reais e independentes do deploy em si: (a)
`docker-compose.yml` sobe Postgres + app + banco de testes em um comando — ambiente
de desenvolvimento local; (b) o `Dockerfile` multi-stage garante portabilidade (a
mesma imagem funcionaria em Cloud Run/ECS/Render) e é validado por build + smoke test
a cada PR no job `docker` do CI. Formalizado como ADR própria —
[`docs/adr/006-vercel-nao-docker-producao.md`](./docs/adr/006-vercel-nao-docker-producao.md),
incluindo as alternativas de deploy do container avaliadas e descartadas (Cloud Run,
ECS, Render) e por quê.

## Arquitetura

Visão de contexto/container e diagrama de camadas (C4, em Mermaid), com legenda
explicando por que Auth.js não é desenhado como serviço externo (roda dentro do próprio
processo Next.js) e onde o `Route Handler` se encaixa em relação a `domain`/
`application`/`infra`:

- [`docs/arquitetura.md`](./docs/arquitetura.md)

Decisões de arquitetura registradas como ADR, `001` a `006`, sem buraco na numeração:

| ADR                                                 | Decisão                                          |
| --------------------------------------------------- | ------------------------------------------------ |
| [001](./docs/adr/001-nextjs-fullstack.md)           | Next.js fullstack, não Next.js + NestJS separado |
| [002](./docs/adr/002-postgres-prisma.md)            | PostgreSQL com Prisma ORM                        |
| [003](./docs/adr/003-node-24.md)                    | Node 24 (não Node 22) em dev, CI e container     |
| [004](./docs/adr/004-auth-js-credentials.md)        | Auth.js v5, provider Credentials, sessão JWT     |
| [005](./docs/adr/005-historico-transacional.md)     | Histórico transacional e 404 uniforme            |
| [006](./docs/adr/006-vercel-nao-docker-producao.md) | Vercel (não o container Docker) em produção      |

## Pré-requisitos

- Node.js 24+ (ou compatível — ver nota abaixo)
- npm
- Docker e Docker Compose (para subir Postgres localmente)

> **Nota sobre versão do Node:** o `docker-compose.yml` usa a imagem
> `node:24-alpine` para o serviço `app`. O npm 10 (padrão do Node 22)
> não reconcilia a estrutura de override do lockfile gerada pelo npm 11;
> use Node 24+ (npm 11+) local e em CI para evitar falha no `npm ci`.

## Como subir com Docker Compose

```bash
cp .env.example .env
```

**Gere o `AUTH_SECRET` antes de continuar — é obrigatório.** Sem ele o
Auth.js recusa qualquer login/cadastro com `MissingSecret` (o sintoma na UI é
"E-mail ou senha inválidos", mesmo com credenciais corretas):

```bash
openssl rand -base64 32
```

Cole o valor gerado na variável `AUTH_SECRET` do `.env`. Em seguida:

```bash
docker compose up --build
```

Isso sobe três serviços:

- `db`: PostgreSQL 16 na porta `5432` (banco `resolve_ai`), com volume
  nomeado persistente.
- `db-test`: PostgreSQL 16 na porta `5433` (banco `resolve_ai_test`), sem
  persistência (dados em tmpfs), usado pelos testes de integração.
- `app`: a aplicação Next.js, na porta `3000`, rodando `npm ci`,
  `npx prisma generate`, `npx prisma migrate deploy` e `npm run dev` dentro
  do container — o banco sobe com o schema já aplicado.

Depois que o container `app` estiver de pé, popule o banco com os dados de
seed (usuários, categorias e ocorrências de exemplo):

```bash
docker compose exec app npm run db:seed
```

Atalho equivalente via npm: `npm run dev:docker`.

## Como rodar localmente (sem Docker para o app)

```bash
npm install
cp .env.example .env
```

**Gere o `AUTH_SECRET` antes de continuar — é obrigatório**, pelo mesmo
motivo da seção anterior:

```bash
openssl rand -base64 32
```

Cole o valor gerado na variável `AUTH_SECRET` do `.env`. Em seguida:

```bash
docker compose up -d db db-test   # só os bancos
npx prisma migrate deploy         # aplica o schema no banco novo
npm run db:seed                   # popula usuários, categorias e ocorrências
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Testes de integração

`tests/unit/**` usa fakes em memória (`tests/helpers/`) e não toca banco.
`tests/integration/**` bate contra um Postgres real — o serviço `db-test` do
`docker-compose.yml` (porta `5433`, banco `resolve_ai_test`). `npm test` roda
os dois juntos (`vitest.config.ts` inclui as duas pastas); o passo a passo
local:

```bash
docker compose up -d db-test   # só o banco de teste (ou `docker compose up -d` para tudo)
npm run db:migrate:test        # aplica as migrations no db-test — uma vez, ou após migration nova
npm test                       # roda unitários e integração juntos
```

`npm run db:migrate:test` aplica `prisma migrate deploy` contra
`DATABASE_URL_TEST` (lida do `.env`, sem porta/credencial hardcoded no
script). `tests/integration/setup.ts` (registrado em `test.setupFiles`) troca
`process.env.DATABASE_URL` por `DATABASE_URL_TEST` antes de qualquer teste
rodar, sempre que `DATABASE_URL_TEST` estiver definida — isso evita que
`npm test` acidentalmente use o banco de desenvolvimento (`DATABASE_URL`,
porta `5432`, com dados de seed). No CI (`.github/workflows/ci.yml`),
`DATABASE_URL_TEST` nunca é definida (o workflow já aponta `DATABASE_URL`
direto para o Postgres de serviço), então esse redirecionamento não dispara
lá — nada muda no comportamento do CI.

Cada arquivo de teste de integração limpa o banco entre casos com
`resetDatabase()` (`tests/integration/helpers/db.ts`, `TRUNCATE ... CASCADE`
num `beforeEach`) e monta suas próprias fixtures via
`tests/integration/helpers/fixtures.ts` ou diretamente com `prisma` — nunca
via `prisma/seed.ts` (seed é para dados de demonstração, não fixture
determinística de teste). `resetDatabase()` recusa rodar se `DATABASE_URL`
não apontar para um banco cujo nome contenha `_test`, como proteção contra
truncar o banco de dev por engano.

> **Nota — `db-test` não persiste dados entre reinícios do container.** O
> serviço usa `tmpfs` (`docker-compose.yml`), de propósito: cada teste já
> limpa e recria suas próprias fixtures, então persistência entre execuções
> nunca foi necessária. Consequência prática: se o container `db-test` for
> recriado/reiniciado (`docker compose down` + `up`, ou uma máquina que
> reinicia), o **schema** também se perde, não só os dados — rode
> `npm run db:migrate:test` de novo antes do próximo `npm test`, ou o
> primeiro teste falha por tabela inexistente, não por dado ausente.

## Testes e2e (Playwright)

`npm run test:e2e` depende de um build de produção **já existente**:
`webServer.command` (`playwright.config.ts`) só roda `npm run start`, nunca
`npm run build`. Quem clonar o repositório e rodar `npm run test:e2e` sem
antes buildar recebe o servidor de produção subindo contra um `.next/`
inexistente ou desatualizado — rode `npm run build` uma vez (ou de novo após
mudar código) antes de `npm run test:e2e`. No CI, isso não é um problema: o
job `e2e` do workflow já builda explicitamente antes de rodar os testes.

## Scripts disponíveis

| Script                    | Descrição                                                                    |
| ------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`             | Sobe o servidor de desenvolvimento                                           |
| `npm run build`           | Build de produção                                                            |
| `npm run start`           | Sobe o build de produção                                                     |
| `npm run lint`            | ESLint                                                                       |
| `npm run typecheck`       | Checagem de tipos (`tsc --noEmit`)                                           |
| `npm run format`          | Formata o código com Prettier                                                |
| `npm run format:check`    | Verifica formatação sem alterar arquivos                                     |
| `npm run test`            | Testes unitários/integração (Vitest)                                         |
| `npm run test:watch`      | Vitest em modo watch                                                         |
| `npm run test:cov`        | Testes com cobertura                                                         |
| `npm run test:e2e`        | Testes end-to-end (Playwright)                                               |
| `npm run dev:docker`      | Sobe tudo via `docker compose up --build`                                    |
| `npm run db:migrate`      | Cria/aplica migrations em desenvolvimento (`prisma migrate dev`)             |
| `npm run db:migrate:test` | Aplica migrations no banco de teste (`db-test`, ver "Testes de integração")  |
| `npm run db:reset`        | Reseta o banco e reaplica migrations + seed (`prisma migrate reset --force`) |
| `npm run db:seed`         | Popula o banco com os dados de seed (`prisma db seed`)                       |
| `npm run db:studio`       | Abre o Prisma Studio para inspecionar o banco                                |

## Variáveis de ambiente

Ver `.env.example` para o conjunto completo. Resumo:

| Variável                | Descrição                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | String de conexão do Postgres principal (usada pela app/Prisma)                                                   |
| `DATABASE_URL_TEST`     | String de conexão do Postgres de testes (`db-test`)                                                               |
| `DIRECT_DATABASE_URL`   | Conexão direta (sem pooling) usada só pela Prisma CLI para migrar — ver "Conexão pooled vs. direta (Neon)" abaixo |
| `AUTH_SECRET`           | Segredo do NextAuth (gere com `openssl rand -base64 32`)                                                          |
| `AUTH_URL`              | URL base da aplicação para o NextAuth (opcional/desnecessária na Vercel — ver seção de deploy)                    |
| `NEXT_PUBLIC_APP_NAME`  | Nome público da aplicação, exposto ao client                                                                      |
| `BLOB_READ_WRITE_TOKEN` | Opcional. Ver "Upload de imagem" abaixo — ausente = storage local                                                 |

### Conexão pooled vs. direta (Neon)

O Prisma CLI (`migrate deploy`, `migrate dev`, `db push`) usa `directUrl` do
`datasource` em `prisma/schema.prisma` quando declarada, em vez de `url` — a
aplicação em runtime (o Client, instanciado em `src/core/db/prisma.ts`)
sempre usa `url` (`DATABASE_URL`), nunca `directUrl`. Isso existe por causa
da Vercel: a integração Vercel↔Neon injeta uma `DATABASE_URL` **pooled** (via
PgBouncer) por padrão — a Prisma recomenda não rodar `migrate deploy` sobre
uma conexão pooled (o lock consultivo de migração pode falhar/comportar-se
mal via PgBouncer). Em produção, `DIRECT_DATABASE_URL` deve apontar para a
conexão **direta** que a integração Neon expõe (o nome exato da variável que
a Neon injeta varia — confirme no painel "Storage" do projeto na Vercel ao
conectar; ver checklist de deploy abaixo).

Em todo ambiente sem pooling (dev local, `db-test`, CI) não há distinção
entre "direto" e "pooled" — `DIRECT_DATABASE_URL` aponta para o mesmo valor
de `DATABASE_URL` (`.env.example`, `docker-compose.yml` e os três jobs de
`.github/workflows/ci.yml` já fazem isso). O Prisma **exige**
`DIRECT_DATABASE_URL` resolvida sempre que `directUrl` está declarada no
schema, mesmo nesses ambientes — sem isso, qualquer comando Prisma quebra.

`.env.example`/`.env` usam `localhost` em `DATABASE_URL`/`DATABASE_URL_TEST`
porque é o valor correto para quem roda `npm run dev` no host (as portas do
Postgres são publicadas em `5432`/`5433`). O serviço `app` do
`docker-compose.yml` sobrescreve essas duas variáveis via `environment:`
apontando para os nomes de serviço (`db`/`db-test`) na porta interna
`5432`, já que dentro da rede do compose `localhost` resolveria para o
próprio container `app`.

### Upload de imagem (`BLOB_READ_WRITE_TOKEN`)

`POST /api/v1/uploads` grava a imagem enviada num de dois lugares, escolhidos
automaticamente por `src/modules/occurrence/infra/file-storage.ts` conforme a
variável `BLOB_READ_WRITE_TOKEN` existir ou não — nenhuma das duas exige
configuração manual do lado do código:

- **Ausente (padrão em dev e no Docker Compose):** grava em
  `.storage/uploads/` na raiz do projeto e serve o arquivo de volta por
  `GET /api/v1/uploads/[...key]` (rota autenticada). Este diretório nunca é
  versionado (está no `.gitignore`) e não sobrevive a um novo deploy.
- **Presente (Vercel, com um Blob store conectado ao projeto):** grava no
  **Vercel Blob**, e a plataforma injeta a variável automaticamente — não é
  algo que se define à mão no `.env` de produção.

**Consequência de esquecer de conectar o Blob store em produção:** a
ausência da variável não gera erro de configuração nenhum — o servidor sobe
normalmente e escolhe `localFileStorage` por padrão, que tenta gravar em
`.storage/uploads/` num filesystem somente leitura (funções serverless da
Vercel). O sintoma só aparece no primeiro upload: `POST /api/v1/uploads`
responde `500`, sem nenhuma pista de que a causa é uma variável de ambiente
ausente. Antes de qualquer deploy de produção, confirme que um Blob store
está conectado ao projeto na Vercel.

## Deploy (Vercel + Neon + Blob)

Fluxo: importar o repositório GitHub na Vercel, provisionar um Postgres pela
integração nativa Vercel↔Neon (aba "Storage" do projeto) e provisionar um
Vercel Blob store. A integração injeta `DATABASE_URL` e
`BLOB_READ_WRITE_TOKEN` automaticamente — **mas não aplica migrations nem
popula dados sozinha**. `vercel.json` (`buildCommand`) cobre as migrations a
cada build; o resto deste checklist é manual, uma vez.

### Checklist de variáveis de ambiente na Vercel

| Variável                | Origem em produção                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | **Automática** — injetada pela integração Vercel↔Neon (conexão pooled, via PgBouncer)                                                                                                                                                                                                                                                                   |
| `DIRECT_DATABASE_URL`   | **Manual** — copiar da conexão _direta_ (sem pooling) que a integração Neon expõe. O nome exato da variável que a Neon disponibiliza varia (frequentemente algo como `DATABASE_URL_UNPOOLED` ou similar) — confirme no painel "Storage" do projeto na Vercel ao conectar e copie o valor para `DIRECT_DATABASE_URL` nas Environment Variables do projeto |
| `BLOB_READ_WRITE_TOKEN` | **Automática** — injetada pela integração Vercel Blob                                                                                                                                                                                                                                                                                                    |
| `AUTH_SECRET`           | **Manual** — gerar com `openssl rand -base64 32` e colar no painel (Project Settings → Environment Variables)                                                                                                                                                                                                                                            |
| `AUTH_URL`              | **Não configurar.** Ver decisão abaixo                                                                                                                                                                                                                                                                                                                   |
| `AUTH_TRUST_HOST`       | **Não configurar.** Ver decisão abaixo                                                                                                                                                                                                                                                                                                                   |
| `NEXT_PUBLIC_APP_NAME`  | Manual, opcional — tem default no código (`"Resolve Aí"`), só configure se quiser um nome diferente                                                                                                                                                                                                                                                      |

### Decisão: `AUTH_URL` e `AUTH_TRUST_HOST` na Vercel

Nenhuma das duas precisa ser configurada manualmente na Vercel — confirmado
lendo `src/auth.config.ts`/`src/auth.ts` (nenhuma referência a
`AUTH_TRUST_HOST` no código; a checagem de host confiável vem só do próprio
Auth.js) e a documentação oficial do Auth.js v5 sobre deploy:

- **`AUTH_TRUST_HOST`**: o Auth.js v5 detecta automaticamente a variável de
  ambiente `VERCEL` (que a própria Vercel injeta em todo deploy) e, quando
  presente, já assume o host como confiável — equivalente a
  `AUTH_TRUST_HOST=true` sem precisar declarar nada. Isso é diferente do
  Docker Compose/CI deste projeto (job `docker` do `ci.yml`), onde
  `AUTH_TRUST_HOST=true` **precisa** ser setado manualmente porque não há
  detecção automática de plataforma nesse ambiente (ver comentário no
  próprio `ci.yml` sobre o `UntrustedHost` do Dia 4).
- **`AUTH_URL`**: a documentação do Auth.js v5 descreve esta variável como
  "majoritariamente desnecessária" a partir da v5 — o host é inferido dos
  headers da própria requisição. Só é preciso declará-la para casos como um
  `basePath` de auth atrás de um domínio/subpath diferente do padrão, o que
  não é o caso deste projeto (`basePath: '/api/v1/auth'` já é relativo à
  origem do próprio deploy).

Se o login apresentar `UntrustedHost` em produção mesmo assim (por exemplo,
domínio customizado com alguma configuração de proxy atípica), o primeiro
passo é configurar `AUTH_TRUST_HOST=true` manualmente no painel — mas isso
não é esperado no fluxo padrão Vercel-nativo descrito aqui.

### Seed de produção — passo manual, único (nunca automatizado)

**Não é rodado automaticamente em nenhum ponto do deploy.**
`prisma/seed.ts` começa limpando as tabelas (`deleteMany()`) antes de
recriar os dados de demonstração — rodar isso a cada build/deploy da Vercel
apagaria dados reais assim que o produto tivesse o primeiro uso real. Por
isso o `buildCommand` do `vercel.json` só roda `prisma migrate deploy`,
nunca `prisma db seed`.

Depois que o primeiro deploy com o schema já migrado estiver de pé, rode o
seed manualmente, uma única vez, com a `DATABASE_URL` de produção exportada
temporariamente no shell local (nunca commitada em arquivo nenhum):

```bash
DATABASE_URL="<DATABASE_URL de produção, copiada do painel da Vercel>" \
DIRECT_DATABASE_URL="<mesma URL, ou a conexão direta — ver checklist acima>" \
npx prisma db seed
```

**Aviso:** rodar este comando de novo **apaga e recria** todos os dados
(por causa do `deleteMany()` no início do script) — é seguro rodar contra um
banco vazio ou só de demonstração, mas **nunca** contra produção já com
dados reais de usuários.

### Checklist final — conectar Vercel + Neon + Blob

1. Importar o repositório GitHub como um novo projeto na Vercel.
   **A Vercel já dispara um build automático neste momento**, antes de
   qualquer variável de ambiente existir — como o `buildCommand` roda
   `prisma migrate deploy` antes de tudo, esse primeiro build **vai
   falhar** por falta de `DATABASE_URL`/`DIRECT_DATABASE_URL`. Isso é
   esperado, não é um erro de configuração: ignore essa falha e continue
   os passos abaixo; o próximo deploy (passo 8) já sai correto.
2. Na aba **Storage** do projeto, conectar um **Postgres via a integração
   Neon** — isso injeta `DATABASE_URL` (pooled) automaticamente.
3. Ainda na aba **Storage**, conectar um **Blob store** — isso injeta
   `BLOB_READ_WRITE_TOKEN` automaticamente.
4. Abrir o painel da integração Neon (ou o dashboard da Neon diretamente) e
   copiar a variável de conexão **direta/sem pooling** (nome exato a
   confirmar no painel — algo como `DATABASE_URL_UNPOOLED` ou similar).
   Colar esse valor em **Project Settings → Environment Variables** como
   `DIRECT_DATABASE_URL` (Production, e Preview se for usar preview
   deployments com banco real).
5. Gerar o segredo do NextAuth: `openssl rand -base64 32`. Colar em
   **Project Settings → Environment Variables** como `AUTH_SECRET`
   (Production).
6. **Não** configurar `AUTH_URL` nem `AUTH_TRUST_HOST` (ver decisão acima) —
   só voltar aqui se o login falhar com `UntrustedHost` depois do deploy.
7. (Opcional) Configurar `NEXT_PUBLIC_APP_NAME` se quiser um nome diferente
   de `"Resolve Aí"`.
   **Ambiente Preview**: o `vercel.json` não distingue Production de
   Preview — todo deploy de PR também roda `prisma migrate deploy` no
   build. Se for usar Preview Deployments, replique `DIRECT_DATABASE_URL`
   e `AUTH_SECRET` também no ambiente **Preview** (passos 4-5 têm essa
   opção ao salvar a variável); sem isso, só os builds de Preview falham —
   produção não é afetada.
8. Disparar o deploy (`git push` para a branch conectada, ou "Deploy" no
   painel). O `buildCommand` do `vercel.json` roda `prisma migrate deploy`
   antes do `npm run build` — a primeira build já sobe com o schema
   aplicado no Neon.
9. Conferir que o deploy ficou saudável: abrir `/api/v1/health` da URL de
   produção e confirmar `{"status":"ok"}`.
10. Rodar o seed de produção **uma única vez**, manualmente, com o comando
    da seção acima (usuários/categorias/ocorrências de demonstração).
11. Testar o login com um dos usuários do seed (ex.: `gestor1@resolveai.com`
    / `Senha@123`) e confirmar que a sessão persiste e o dashboard carrega.
12. Testar um upload de imagem numa ocorrência nova, para confirmar que o
    Blob store está conectado corretamente (sem isso, o upload responde
    `500` — ver "Upload de imagem" acima).

## Rotas da API

Todas sob `/api/v1`, versão exigida pelo ADR 004. Erro sempre em
`application/problem+json` (RFC 7807); "Autenticado" = exige o cookie de sessão do
Auth.js (`requireSession`), com o papel entre parênteses quando a rota também exige
`requireRole` (checado no use-case, não só no Route Handler — ver
[ADR 001](./docs/adr/001-nextjs-fullstack.md) e `docs/PLANO.md` §2.3). 13 rotas
distintas, 16 operações (método × rota) — lista completa, conferida linha a linha
contra `src/core/openapi/registry.ts` nesta tarefa:

> **Contrato completo e sempre atualizado:** esta tabela é um resumo de leitura rápida.
> Para o contrato de verdade — parâmetros, corpo de requisição/resposta por status,
> exemplos e todos os erros RFC 7807 possíveis por rota — abra `/api/docs` (UI Scalar,
> gerada em runtime a partir dos schemas Zod, item 3 da matriz de rastreabilidade acima)
> ou leia `openapi.json` na raiz do repositório.

| Método | Rota                                | Autenticado          | Descrição                                                                |
| ------ | ----------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| POST   | `/api/v1/auth/register`             | não                  | Cadastro público de usuário (papel sempre `SOLICITANTE`)                 |
| GET    | `/api/v1/auth/{nextauthAction}`     | não                  | Catch-all do Auth.js — sessão, CSRF, provedores, início de login         |
| POST   | `/api/v1/auth/{nextauthAction}`     | não                  | Catch-all do Auth.js — `callback/credentials` é o login efetivo          |
| GET    | `/api/v1/categories`                | sim                  | Lista categorias ativas (formulário e filtro)                            |
| GET    | `/api/v1/occurrences`               | sim                  | Lista ocorrências — filtros, paginação; Solicitante só vê as próprias    |
| POST   | `/api/v1/occurrences`               | sim                  | Cria uma ocorrência (`status`/`priority` iniciais fixados pelo servidor) |
| GET    | `/api/v1/occurrences/{id}`          | sim                  | Detalhe com histórico, comentários e avaliação (404 uniforme — ADR 005)  |
| PATCH  | `/api/v1/occurrences/{id}`          | sim (Gestor)         | Prioridade e/ou responsável — não é transição de status                  |
| POST   | `/api/v1/occurrences/{id}/status`   | sim (Gestor/autor\*) | Muda o status (máquina de estados); \*autor só cancela a própria         |
| GET    | `/api/v1/occurrences/{id}/history`  | sim                  | Linha do tempo (histórico de status) em ordem cronológica                |
| POST   | `/api/v1/occurrences/{id}/comments` | sim                  | Adiciona um comentário à ocorrência                                      |
| POST   | `/api/v1/occurrences/{id}/rating`   | sim (autor)          | Avalia (1–5 estrelas) uma ocorrência própria já `RESOLVIDA`              |
| POST   | `/api/v1/uploads`                   | sim                  | Upload de imagem (`multipart/form-data`, até 5 MB), devolve `{ key }`    |
| GET    | `/api/v1/uploads/{key}`             | sim                  | Serve o arquivo do storage local (irrelevante com Vercel Blob)           |
| GET    | `/api/v1/dashboard/metrics`         | sim (Gestor)         | Indicadores agregados do dashboard                                       |
| GET    | `/api/v1/health`                    | não                  | Healthcheck — toca o schema real, não só a conexão                       |

Telas autenticadas (`src/app/(app)/`): `/ocorrencias` (lista, com filtros de status,
categoria, prioridade e busca), `/ocorrencias/nova` (formulário), `/ocorrencias/[id]`
(detalhe, timeline, comentários e — quando `RESOLVIDA` — o card de avaliação do
solicitante) e `/dashboard` (visível só para `GESTOR`).

## Estrutura do projeto

```
src/app/(auth)/        rotas públicas de autenticação
src/app/(app)/         rotas autenticadas da aplicação
src/app/api/v1/        rotas de API (REST) — ver "Rotas da API" acima
src/modules/           módulos de domínio (occurrence, identity, feedback),
                        cada um com domain/application/infra
src/core/               código transversal (errors, http, db)
src/lib/                utilitários de UI que não são regra de negócio (ex.:
                        src/lib/occurrences/: rótulo/cor de status e
                        prioridade, parsing de filtro da URL — puros,
                        sem I/O, mas fora de src/modules/ porque não fazem
                        parte de nenhum módulo de domínio)
src/components/ui/      componentes gerados pelo shadcn/ui (alias "@/components/ui")
.storage/uploads/       storage local de imagem (adaptador local de FileStorage;
                        não versionado, não existe em produção — ver Blob acima)
tests/unit/             testes unitários (Vitest)
tests/integration/      testes de integração (Vitest)
tests/e2e/              testes end-to-end (Playwright)
docs/adr/               Architecture Decision Records (001 a 006)
docs/arquitetura.md     diagramas C4 (contexto/container + camadas), em Mermaid
docs/der.md             DER do modelo de dados
docs/apresentacao.md    roteiro de apresentação/demonstração
```

**Sobre `feedback/` estar vazio (só `.gitkeep` nas três pastas), estado final depois
dos 5 dias:** tanto comentário (`CommentEntry`, `addComment`) quanto avaliação
(`RatingEntry`, `rateOccurrence`) terminaram morando em `occurrence/`, não em
`feedback/` — nenhum dos dois tem ciclo de vida próprio fora do agregado
`Occurrence` (ambos são criados, listados e lidos sempre junto com a ocorrência à qual
pertencem, nunca sozinhos, e a regra "só após `RESOLVIDA`, uma vez por ocorrência" da
avaliação está em `domain`/`application` de `occurrence/`, não de `feedback/`). O
`docs/PLANO.md` original previa `feedback/` como o módulo da avaliação; na
implementação real (Dia 3) ficou mais simples manter os dois agregados-filhos de
`Occurrence` juntos no mesmo módulo do que dividir por tipo de conteúdo — `feedback/`
ficou reservado, sem uso, e é candidato a remoção ou a um propósito futuro (ex.: um
tipo de feedback que não seja sobre uma ocorrência específica), não um objetivo
pendente desta entrega.

## Usuários de seed

`npm run db:seed` cria os usuários abaixo, todos com a senha `Senha@123`:

| E-mail                  | Papel         |
| ----------------------- | ------------- |
| `gestor1@resolveai.com` | `GESTOR`      |
| `gestor2@resolveai.com` | `GESTOR`      |
| `ana@resolveai.com`     | `SOLICITANTE` |
| `bruno@resolveai.com`   | `SOLICITANTE` |
| `carla@resolveai.com`   | `SOLICITANTE` |

## Ambiente público

**Ainda não publicado.** A infraestrutura e o checklist de deploy (seção "Deploy" acima)
estão prontos — `vercel.json`, variáveis documentadas, seed de produção com passo a
passo — mas conectar o repositório à Vercel e executar o deploy é um passo manual do
usuário, fora desta sessão de trabalho (ver item 8 da matriz de rastreabilidade e o
relatório da Tarefa 4 em `docs/sdd/dia-05/`). Depois do primeiro deploy real, esta seção
deve ser atualizada com a URL pública e, se aplicável, um link para o preview de PR.
Até lá, a evidência de que a aplicação builda e roda de ponta a ponta é o job `docker`
do CI (build da imagem + smoke test a cada PR) — ver [ADR 006](./docs/adr/006-vercel-nao-docker-producao.md).
