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
- **ORM:** Prisma <!-- TODO Dia 2: schema, migrations e seed -->
- **Autenticação:** NextAuth <!-- TODO Dia 3: provedores e sessão -->
- **Testes:** Vitest (unitário/integração) + Playwright (e2e)
- **Deploy:** Vercel (aplicação) + Neon (Postgres gerenciado)
  <!-- TODO Dia 5: URL pública -->

## Pré-requisitos

- Node.js 22+ (ou compatível — ver nota abaixo)
- npm
- Docker e Docker Compose (para subir Postgres localmente)

> **Nota sobre versão do Node:** o `docker-compose.yml` usa a imagem
> `node:22-alpine` para o serviço `app`. Localmente, o projeto foi
> desenvolvido e validado também com Node 26; use a versão que preferir,
> desde que compatível com Next.js 15.

## Como subir com Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Isso sobe três serviços:

- `db`: PostgreSQL 16 na porta `5432` (banco `resolve_ai`), com volume
  nomeado persistente.
- `db-test`: PostgreSQL 16 na porta `5433` (banco `resolve_ai_test`), sem
  persistência (dados em tmpfs), usado pelos testes de integração.
- `app`: a aplicação Next.js, na porta `3000`, rodando `npm ci`,
  `npx prisma generate` e `npm run dev` dentro do container.

Atalho equivalente via npm: `npm run dev:docker`.

## Como rodar localmente (sem Docker para o app)

```bash
npm install
cp .env.example .env
docker compose up -d db db-test   # só os bancos
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts disponíveis

| Script                 | Descrição                                 |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Sobe o servidor de desenvolvimento        |
| `npm run build`        | Build de produção                         |
| `npm run start`        | Sobe o build de produção                  |
| `npm run lint`         | ESLint                                    |
| `npm run typecheck`    | Checagem de tipos (`tsc --noEmit`)        |
| `npm run format`       | Formata o código com Prettier             |
| `npm run format:check` | Verifica formatação sem alterar arquivos  |
| `npm run test`         | Testes unitários/integração (Vitest)      |
| `npm run test:watch`   | Vitest em modo watch                      |
| `npm run test:cov`     | Testes com cobertura                      |
| `npm run test:e2e`     | Testes end-to-end (Playwright)            |
| `npm run dev:docker`   | Sobe tudo via `docker compose up --build` |

## Variáveis de ambiente

Ver `.env.example` para o conjunto completo. Resumo:

| Variável               | Descrição                                                       |
| ---------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`         | String de conexão do Postgres principal (usada pela app/Prisma) |
| `DATABASE_URL_TEST`    | String de conexão do Postgres de testes (`db-test`)             |
| `AUTH_SECRET`          | Segredo do NextAuth (gere com `openssl rand -base64 32`)        |
| `AUTH_URL`             | URL base da aplicação para o NextAuth                           |
| `NEXT_PUBLIC_APP_NAME` | Nome público da aplicação, exposto ao client                    |

## Estrutura do projeto

```
src/app/(auth)/        rotas públicas de autenticação
src/app/(app)/         rotas autenticadas da aplicação
src/app/api/v1/        rotas de API (REST)
src/modules/           módulos de domínio (occurrence, identity, feedback),
                        cada um com domain/application/infra
src/core/               código transversal (errors, http, db)
src/ui/                 componentes de UI compartilhados fora do shadcn
src/components/ui/      componentes gerados pelo shadcn/ui
tests/unit/             testes unitários (Vitest)
tests/integration/      testes de integração (Vitest)
tests/e2e/              testes end-to-end (Playwright)
docs/adr/               Architecture Decision Records
```

## Usuários de seed

<!-- TODO Dia 5: credenciais de usuários de teste criados pelo seed -->

## Ambiente público

<!-- TODO Dia 5: URL de produção (Vercel) -->
