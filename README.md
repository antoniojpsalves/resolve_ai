# Resolve Aí

Plataforma de gestão de ocorrências. Permite registrar, acompanhar e resolver
ocorrências, com autenticação de usuários e coleta de feedback.

<!-- TODO Dia 5: descrição funcional completa do produto, screenshots -->

## Stack

- **Framework:** Next.js 15 (App Router, fullstack — front-end e API na mesma
  aplicação)
- **Linguagem:** TypeScript
- **Estilo/UI:** Tailwind CSS + shadcn/ui (estilo `new-york`, cor base `slate`)
- **Banco de dados:** PostgreSQL
- **ORM:** Prisma (schema, migrations e seed determinístico já entregues)
- **Autenticação:** NextAuth (Auth.js v5, provider Credentials, sessão JWT)
- **Testes:** Vitest (unitário/integração) + Playwright (e2e)
- **Deploy:** Vercel (aplicação) + Neon (Postgres gerenciado)
  <!-- TODO Dia 5: URL pública -->

## Matriz de rastreabilidade

Régua de "o que o enunciado pede" → "o que existe hoje no repositório", conferida
linha a linha contra o código nesta tarefa (Dia 5, Tarefa 3) — não é o que foi
planejado em `docs/PLANO.md`, é o estado real. Nada nesta tabela é considerado
pronto sem a coluna "onde comprova" apontar para um arquivo/rota real.

| #   | Exigência do enunciado  | Como atendemos                                                                                                                                        | Onde comprova                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Arquitetura de software | Camadas `domain`/`application`/`infra` por módulo; dependency inversion nos repositórios (ports + Prisma na `infra`)                                  | `src/modules/occurrence/{domain,application,infra}/`, `src/modules/identity/{domain,application,infra}/`, `docs/adr/002-postgres-prisma.md`, `docs/adr/004-auth-js-credentials.md`, `docs/adr/005-historico-transacional.md`. Diagrama C4 ainda **não existe** (`docs/arquitetura.md`) — Tarefa 4.                                                                |
| 2   | Backend                 | Route Handlers do Next.js como camada de transporte só; use-cases isolados; validação Zod colocalizada com o use-case                                 | `src/app/api/v1/**/route.ts` (13 rotas — `find src/app/api -name route.ts`), `src/modules/*/application/*.ts` (schema Zod + use-case no mesmo arquivo, ex. `create-occurrence.ts`)                                                                                                                                                                                |
| 3   | APIs                    | REST versionada `/api/v1`; contrato OpenAPI 3.1 **gerado** dos schemas Zod já existentes (não escrito à mão) — Tarefa 3, Dia 5                        | `/api/docs` (UI Scalar, `src/app/api/docs/route.ts`) + `openapi.json` (raiz do repo, gerado por `npm run openapi:generate` → `scripts/generate-openapi.ts`) + registro em `src/core/openapi/`. Validado com `@apidevtools/swagger-parser` e `npx @redocly/cli lint` — ver `docs/sdd/dia-05/tarefa-3-relatorio.md` (fora deste repo) para a evidência de execução. |
| 4   | Banco de dados          | PostgreSQL, migrations versionadas, seed determinístico                                                                                               | `prisma/schema.prisma`, `prisma/migrations/20260904192051_init/`, `prisma/seed.ts`, DER em `docs/der.md`                                                                                                                                                                                                                                                          |
| 5   | Frontend                | App Router + Server Components; Tailwind + shadcn/ui; responsivo e com varredura automatizada de acessibilidade                                       | `src/app/(app)/**`, `src/app/(auth)/**`, `src/components/ui/**` (shadcn); responsivo — commit `fix(layout): corrige overflow horizontal do header em mobile (375px)`; acessível — `tests/e2e/accessibility.spec.ts` (axe-core, `wcag2a`+`wcag2aa`)                                                                                                                |
| 6   | Testes                  | Unit (Vitest) + integração de API (Vitest + Postgres real) + e2e (Playwright)                                                                         | `tests/unit/**` (34 arquivos), `tests/integration/**` (5 arquivos, banco Postgres real), `tests/e2e/**` (3 specs) — `npm test` roda 406 testes (todos verdes nesta tarefa); cobertura e `playwright-report/` são publicados como artifact dos jobs `test`/`e2e` do CI (`.github/workflows/ci.yml`), não commitados (`.gitignore`)                                 |
| 7   | Docker                  | `docker-compose.yml` (Postgres + app + banco de testes, um comando) + `Dockerfile` multi-stage (`output: 'standalone'`) validado no CI                | `docker-compose.yml`, `Dockerfile`, job `docker` de `.github/workflows/ci.yml` (build da imagem + smoke test de `/api/v1/health`, `/` e login sem `500 UntrustedHost`, a cada PR)                                                                                                                                                                                 |
| 8   | Deploy em Cloud         | Vercel (app) + Neon (Postgres) + Vercel Blob (imagens) — infraestrutura e checklist prontos; deploy real é passo manual do usuário, fora desta sessão | `vercel.json`, seção "Deploy (Vercel + Neon + Blob)" deste README (checklist completo de variáveis e passos). URL pública e preview por PR: **pendente** — depende do usuário conectar o projeto na Vercel                                                                                                                                                        |
| 9   | Documentação            | README, ADRs, DER, contrato OpenAPI, guia de execução local                                                                                           | `README.md`, `docs/adr/{002,004,005}-*.md`, `docs/der.md`, `/api/docs` + `openapi.json` (item 3). Diagrama de arquitetura (C4) e ADR "Docker vs. Vercel" ainda pendentes — Tarefa 4                                                                                                                                                                               |

**Sobre Docker + Vercel** (o `docs/PLANO.md` original já antecipava que isso precisa
estar explícito): a Vercel **não executa o `Dockerfile`** deste projeto —
`vercel.json` (acima) só declara um `buildCommand` (`prisma migrate deploy && npm run
build`), a Vercel builda com o próprio pipeline do Next.js, sem tocar na imagem
Docker. O Docker cumpre dois papéis reais e independentes do deploy em si: (a)
`docker-compose.yml` sobe Postgres + app + banco de testes em um comando — ambiente
de desenvolvimento local; (b) o `Dockerfile` multi-stage garante portabilidade (a
mesma imagem funcionaria em Cloud Run/ECS/Render) e é validado por build + smoke test
a cada PR no job `docker` do CI. Isto vira uma ADR própria ("por que Vercel e não
container em produção") na Tarefa 4 — aqui só o registro de onde cada peça mora.

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
| `DATABASE_URL`          | **Automática** — injetada pela integração Vercel↔Neon (conexão pooled, via PgBouncer)                                                                                                                                                                                                                                                                    |
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

Todas sob `/api/v1`, versão exigida pelo ADR 004. `POST`/`GET` sem detalhe adicional na
tabela seguem o padrão do projeto: corpo/erro em `application/problem+json`, sessão via
cookie do NextAuth quando marcada como autenticada.

> **Contrato completo e sempre atualizado:** a tabela abaixo é um resumo de leitura
> rápida (não relista rotas adicionadas depois, como `POST .../status`,
> `POST .../rating` e `GET /dashboard/metrics`). Para o contrato de verdade — todas as
> rotas, parâmetros, corpo de requisição/resposta e erros RFC 7807 — abra `/api/docs`
> (gerado a partir dos schemas Zod, ver item 3 da matriz de rastreabilidade acima) ou
> leia `openapi.json` na raiz do repositório.

| Rota                                | Método | Autenticado | Descrição                                                    |
| ----------------------------------- | ------ | ----------- | ------------------------------------------------------------ |
| `/api/v1/auth/register`             | POST   | não         | Cadastro de usuário                                          |
| `/api/v1/auth/[...nextauth]`        | \*     | não         | Login/sessão (Auth.js)                                       |
| `/api/v1/health`                    | GET    | não         | Healthcheck (toca o schema, não só a conexão)                |
| `/api/v1/categories`                | GET    | sim         | Lista categorias ativas (para formulário e filtro)           |
| `/api/v1/occurrences`               | GET    | sim         | Lista ocorrências, com filtro/paginação e recorte por papel  |
| `/api/v1/occurrences`               | POST   | sim         | Cria uma ocorrência                                          |
| `/api/v1/occurrences/[id]`          | GET    | sim         | Detalhe de uma ocorrência (404 uniforme — ver ADR 005)       |
| `/api/v1/occurrences/[id]/history`  | GET    | sim         | Histórico de status (sem consumidor na UI ainda; Dia 3)      |
| `/api/v1/occurrences/[id]/comments` | POST   | sim         | Adiciona um comentário                                       |
| `/api/v1/uploads`                   | POST   | sim         | Recebe a imagem (`multipart/form-data`), devolve `imageKey`  |
| `/api/v1/uploads/[...key]`          | GET    | sim         | Serve o arquivo do storage local (não usado com Vercel Blob) |

Telas autenticadas (`src/app/(app)/`): `/ocorrencias` (lista, com filtros de status,
categoria, prioridade e busca), `/ocorrencias/nova` (formulário), `/ocorrencias/[id]`
(detalhe, timeline e comentários) e `/dashboard` (visível só para `GESTOR`).

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
docs/adr/               Architecture Decision Records
```

**Sobre `feedback/` estar vazio (só `.gitkeep`):** comentário de ocorrência
(`CommentEntry`, `addComment`) mora em `occurrence/`, não em `feedback/` —
comentário não tem ciclo de vida próprio, é parte do agregado `Occurrence`
(criado, listado e lido sempre junto com a ocorrência, nunca sozinho).
`feedback/` fica reservado para a **avaliação** (nota e comentário do
solicitante após a resolução), prevista para o Dia 3, que sim tem um
ciclo de vida e regras próprias (só após `RESOLVIDA`, uma vez por
ocorrência).

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

<!-- TODO Dia 5: URL de produção (Vercel) -->
