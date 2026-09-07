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

| Variável                | Descrição                                                         |
| ----------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`          | String de conexão do Postgres principal (usada pela app/Prisma)   |
| `DATABASE_URL_TEST`     | String de conexão do Postgres de testes (`db-test`)               |
| `AUTH_SECRET`           | Segredo do NextAuth (gere com `openssl rand -base64 32`)          |
| `AUTH_URL`              | URL base da aplicação para o NextAuth                             |
| `NEXT_PUBLIC_APP_NAME`  | Nome público da aplicação, exposto ao client                      |
| `BLOB_READ_WRITE_TOKEN` | Opcional. Ver "Upload de imagem" abaixo — ausente = storage local |

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

## Rotas da API

Todas sob `/api/v1`, versão exigida pelo ADR 004. `POST`/`GET` sem detalhe adicional na
tabela seguem o padrão do projeto: corpo/erro em `application/problem+json`, sessão via
cookie do NextAuth quando marcada como autenticada.

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
