# ADR 002 — PostgreSQL com Prisma ORM

- **Status:** aceita
- **Data:** 2026-09-04

## Contexto

O "Resolve Aí" é um sistema de gestão de ocorrências com dados fortemente relacionais:
usuário, categoria, ocorrência, histórico de status, comentário e avaliação. As consultas
previstas para os Dias 2 e 3 (listagem filtrada por status/prioridade/categoria, painel
gerencial com agregações, contagem de ocorrências por período) são naturalmente SQL.

Precisávamos de um banco e de uma camada de acesso que atendessem a quatro exigências:

1. integridade referencial e transações reais;
2. tipagem estática ponta a ponta em TypeScript, para que uma mudança de schema quebre o
   build e não a produção;
3. migrations versionadas e reproduzíveis em CI e em container;
4. baixo atrito para subir o ambiente local (`docker compose up -d db`).

## Decisão

Adotamos **PostgreSQL 16** (imagem `postgres:16-alpine`) como banco relacional e
**Prisma** como ORM e ferramenta de migrations.

O schema fica em `prisma/schema.prisma`, as migrations em `prisma/migrations/` e o acesso
passa por um singleton em `src/core/db/prisma.ts`. Os use-cases da camada `application/`
não importam o Prisma: eles recebem _ports_ (interfaces) cuja implementação concreta vive
em `modules/<contexto>/infra/`. O domínio (`modules/<contexto>/domain/`) não importa nada
de infraestrutura.

### Versão do Prisma: fixada em `6.19.3`

`prisma` e `@prisma/client` estão fixados em **`6.19.3`**, e isso é uma decisão, não um
esquecimento:

- a dist-tag `latest` do registry aponta hoje para **`8.0.0-rc.13`**, que é um _release
  candidate_ — instalar `prisma@latest` colocaria um RC em produção;
- o último estável de verdade é **`7.10.0`**, uma major acima da que usamos;
- migrar para a linha 7 no Dia 1 não é uma troca de número de versão. A major 7 remove
  `datasource.url` do `schema.prisma`, exige um arquivo `prisma.config.ts` e passa a
  depender de um _driver adapter_ explícito (`@prisma/adapter-pg` + `pg`) para conectar.
  Isso reescreveria a configuração do banco, do seed e do CI logo no dia da fundação,
  trocando risco de entrega por nenhum ganho funcional para o escopo atual.

A atualização para a linha 7 (ou para a 8, quando estável) fica registrada como trabalho
futuro, a ser feita numa janela própria e com o CI já verde para servir de rede de
segurança.

## Alternativas consideradas

**Drizzle ORM.** Mais leve, SQL-first e com boa inferência de tipos. Perde para o Prisma
no ferramental de migrations e no Prisma Studio, que encurtam bastante a inspeção manual
do seed durante o desenvolvimento.

**TypeORM.** Maduro, mas o modelo de decorators e o histórico de migrations frágeis
custam mais manutenção do que oferecem aqui.

**SQL puro com `pg` + Kysely.** Máximo controle e nenhuma camada mágica, ao custo de
escrever à mão o versionamento de schema e o mapeamento de tipos — trabalho que não
diferencia o produto.

**SQLite.** Suficiente para o volume de dados do projeto, mas divergiria do ambiente de
produção (tipos, concorrência, `ILIKE`, agregações) e enfraqueceria o valor do
`docker-compose` como espelho da produção.

## Consequências

**Positivas**

- Tipos do banco derivados do schema: uma coluna renomeada quebra o `npm run typecheck`.
- Migrations versionadas em git e aplicáveis em CI com `npx prisma migrate deploy`.
- Ambiente local e de teste isolados (`db` na 5432, `db-test` na 5433) sem instalar
  Postgres na máquina.
- Fronteira arquitetural preservada: trocar o Prisma exigiria reescrever apenas as
  implementações em `infra/`, não os use-cases.

**Negativas e dívidas conhecidas**

- **Defasagem de versão assumida.** Ficamos duas majors atrás do que o registry considera
  `latest`. Enquanto isso durar, não recebemos correções da linha 7. Aceito conscientemente
  em troca de estabilidade no Dia 1.
- **Aviso de deprecação do bloco `prisma` no `package.json`.** O comando `prisma db seed`
  lê a configuração do bloco `"prisma": { "seed": "tsx prisma/seed.ts" }`, que o Prisma 6
  já marca como deprecado em favor de `prisma.config.ts`. Não migramos porque, na linha 6,
  adotar `prisma.config.ts` **desliga o carregamento automático do `.env`** — o que
  quebraria `db:seed`, `db:migrate` e o CI, ou exigiria embutir `dotenv` em todos eles.
  A dívida é conhecida, aceita e se resolve junto com a migração para a major 7.
- O Prisma Client precisa ser gerado (`npx prisma generate`) após `npm ci`; o CI executa
  esse passo explicitamente no job `quality`.
- O engine binário do Prisma pesa na imagem Docker; o Dia 4 deve tratar isso no build
  multi-stage.

### `npm audit`: 5 vulnerabilidades conhecidas, fix automático não aplicado

`npm audit` reporta 5 vulnerabilidades (4 _high_, 1 _moderate_), todas transitivas e
fora do caminho de requisição:

- **`postcss` (via `next`)** — 3 avisos de XSS/path traversal na etapa de build do
  CSS. `postcss` só roda durante o build (Tailwind), nunca no request path em runtime.
- **`deepmerge-ts` (via `@prisma/config`)** — 1 aviso de esgotamento de pilha ao
  fazer merge de grafos recursivos. `@prisma/config` só é usado pela CLI do Prisma
  (`prisma generate`/`migrate`), não pelo `@prisma/client` em runtime.

O `npm audit fix --force` proposto resolveria instalando `next@16` (major acima da
`15.5.25` fixada) e fazendo _downgrade_ de `prisma` para `6.12.0` — o que contradiz a
decisão de fixar `6.19.3` registrada acima e trocaria uma major do Next não avaliada
por uma correção de uma vulnerabilidade que não afeta o runtime da aplicação. Optamos
por não aplicar o fix automático agora; a correção correta é migrar Next e Prisma em
janelas próprias, com CI verde como rede de segurança, e não como reação ao audit.
