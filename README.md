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

## Scripts disponíveis

| Script                 | Descrição                                                                    |
| ---------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`          | Sobe o servidor de desenvolvimento                                           |
| `npm run build`        | Build de produção                                                            |
| `npm run start`        | Sobe o build de produção                                                     |
| `npm run lint`         | ESLint                                                                       |
| `npm run typecheck`    | Checagem de tipos (`tsc --noEmit`)                                           |
| `npm run format`       | Formata o código com Prettier                                                |
| `npm run format:check` | Verifica formatação sem alterar arquivos                                     |
| `npm run test`         | Testes unitários/integração (Vitest)                                         |
| `npm run test:watch`   | Vitest em modo watch                                                         |
| `npm run test:cov`     | Testes com cobertura                                                         |
| `npm run test:e2e`     | Testes end-to-end (Playwright)                                               |
| `npm run dev:docker`   | Sobe tudo via `docker compose up --build`                                    |
| `npm run db:migrate`   | Cria/aplica migrations em desenvolvimento (`prisma migrate dev`)             |
| `npm run db:reset`     | Reseta o banco e reaplica migrations + seed (`prisma migrate reset --force`) |
| `npm run db:seed`      | Popula o banco com os dados de seed (`prisma db seed`)                       |
| `npm run db:studio`    | Abre o Prisma Studio para inspecionar o banco                                |

## Variáveis de ambiente

Ver `.env.example` para o conjunto completo. Resumo:

| Variável               | Descrição                                                       |
| ---------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`         | String de conexão do Postgres principal (usada pela app/Prisma) |
| `DATABASE_URL_TEST`    | String de conexão do Postgres de testes (`db-test`)             |
| `AUTH_SECRET`          | Segredo do NextAuth (gere com `openssl rand -base64 32`)        |
| `AUTH_URL`             | URL base da aplicação para o NextAuth                           |
| `NEXT_PUBLIC_APP_NAME` | Nome público da aplicação, exposto ao client                    |

`.env.example`/`.env` usam `localhost` em `DATABASE_URL`/`DATABASE_URL_TEST`
porque é o valor correto para quem roda `npm run dev` no host (as portas do
Postgres são publicadas em `5432`/`5433`). O serviço `app` do
`docker-compose.yml` sobrescreve essas duas variáveis via `environment:`
apontando para os nomes de serviço (`db`/`db-test`) na porta interna
`5432`, já que dentro da rede do compose `localhost` resolveria para o
próprio container `app`.

## Estrutura do projeto

```
src/app/(auth)/        rotas públicas de autenticação
src/app/(app)/         rotas autenticadas da aplicação
src/app/api/v1/        rotas de API (REST)
src/modules/           módulos de domínio (occurrence, identity, feedback),
                        cada um com domain/application/infra
src/core/               código transversal (errors, http, db)
src/components/ui/      componentes gerados pelo shadcn/ui (alias "@/components/ui")
tests/unit/             testes unitários (Vitest)
tests/integration/      testes de integração (Vitest)
tests/e2e/              testes end-to-end (Playwright)
docs/adr/               Architecture Decision Records
```

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
