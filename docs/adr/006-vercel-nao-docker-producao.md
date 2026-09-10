# ADR 006 — Vercel (não o container Docker) em produção

- **Status:** aceita
- **Data:** 2026-09-09

## Contexto

O projeto tem, ao mesmo tempo, um `Dockerfile` multi-stage de produção (`deps` →
`builder` → `runner`, `output: 'standalone'`, validado por build + smoke test a cada PR
no job `docker` do CI) **e** um `vercel.json` que declara só um `buildCommand`
(`prisma migrate deploy && npm run build`). Isso pode parecer redundante ou
inconsistente de fora — se o Docker já existe e já é validado no CI, por que a
plataforma de produção não simplesmente builda e roda esse mesmo container?

A resposta exige separar duas perguntas diferentes que o enunciado do desafio junta na
mesma exigência ("Docker" e "Deploy em Cloud" são itens distintos da matriz de
rastreabilidade, `#7` e `#8`):

1. **O Docker prova portabilidade?** Sim — e isso é o que o item `#7` da matriz avalia.
2. **O Docker precisa ser o que roda em produção?** Não necessariamente — e é essa a
   decisão que esta ADR formaliza.

O prazo é de 5 dias, o time é de uma pessoa, e a stack de dados escolhida (Postgres via
Neon, upload de imagem via Vercel Blob — ADR 002 e o `README.md`, seção de upload)
já tem integração nativa com a Vercel: conectar um projeto e clicar em "Storage" injeta
`DATABASE_URL`/`BLOB_READ_WRITE_TOKEN` automaticamente, sem provisionar infraestrutura à
mão.

## Decisão

Em produção, a aplicação roda na **Vercel**, que builda **direto do código-fonte** via
`vercel.json` (`buildCommand`) — **não a partir da imagem Docker**. O `Dockerfile`
continua existindo e cumprindo dois papéis reais, nenhum deles "ser o artefato de
produção":

1. **Ambiente de desenvolvimento local.** `docker-compose.yml` sobe `db` (Postgres 16),
   `db-test` (Postgres de teste, `tmpfs`) e `app` (a aplicação Next.js) com um único
   comando (`docker compose up --build` / `npm run dev:docker`) — elimina "instalar
   Postgres na máquina" como pré-requisito para rodar o projeto.
2. **Prova de portabilidade, validada no CI.** O job `docker` de
   `.github/workflows/ci.yml` builda a imagem de produção (`docker build`) e roda um
   smoke test real (`/api/v1/health`, página inicial, login sem `500 UntrustedHost`) a
   cada PR. Isso comprova que a aplicação **poderia** rodar como container em qualquer
   provedor compatível (Cloud Run, ECS, Render, um VPS qualquer) — sem que esse seja o
   caminho escolhido para este deploy.

A Vercel, ao conectar o repositório GitHub, roda seu próprio pipeline de build para
Next.js (detecção automática de framework, otimizações de imagem/edge, preview
deployment por PR) direto do código — nunca lê nem executa o `Dockerfile` do projeto.
As duas coisas coexistem sem se tocar: o `buildCommand` do `vercel.json` e os `RUN`s do
`Dockerfile` fazem, cada um à sua maneira, "instalar dependências, gerar o Prisma
Client, aplicar migrations, buildar o Next" — mas são dois pipelines paralelos e
independentes, não um dependendo do outro.

## Alternativas consideradas

**Deploy do container em Cloud Run (GCP).** Portável, escala a zero, e a imagem já está
pronta e validada no CI — tecnicamente viável hoje sem trabalho adicional de build.
Rejeitada para este projeto por três motivos concretos: (a) não há integração nativa com
Neon/Vercel Blob — cada uma precisaria ser conectada manualmente via variável de
ambiente/IAM, mais um provisionamento a configurar num prazo de 5 dias; (b) preview
deployment por PR (que a matriz de rastreabilidade, item `#8`, pede) não existe de
forma automática — exigiria um workflow de CI próprio para criar/destruir revisões por
PR, reimplementando o que a integração Git da Vercel já faz; (c)
HTTPS, domínio e CDN de assets exigiriam configuração adicional (Cloud Load Balancer/
Cloud CDN) que a Vercel já resolve por padrão.

**Deploy do container em ECS/Fargate (AWS).** Mesma portabilidade de Cloud Run, com
ainda mais peças para configurar antes do primeiro deploy (VPC, task definition,
service, load balancer, IAM roles) — o tipo de trabalho de infraestrutura que compete
diretamente com o tempo dedicado a documentação e polimento. Rejeitada pelo
mesmo motivo de prazo, de forma ainda mais acentuada.

**Deploy do container em Render.** O mais próximo em simplicidade da Vercel entre as
opções de container avaliadas — suporta `Dockerfile` nativamente e tem um free tier.
Ainda assim, não tem a integração nativa com Neon (precisaria configurar a
`DATABASE_URL` manualmente, o que não é um problema grande em si, mas remove o
diferencial que decidiu a favor da Vercel) nem com Vercel Blob (exigiria trocar o
adaptador de storage, `src/modules/occurrence/infra/file-storage.ts`, por outro provedor
— código novo, fora do escopo de "só fazer o deploy"). Rejeitada por não ganhar nada
sobre a Vercel para este projeto especificamente, dado que o storage de imagem já foi
desenhado em torno do Vercel Blob.

**Rodar o próprio `Dockerfile` na Vercel** (a plataforma suporta builds via container em
alguns planos/fluxos). Eliminaria a "duplicidade" percebida de ter dois pipelines de
build. Rejeitada porque a Vercel builda Next.js nativamente melhor do que builda uma
imagem genérica (otimizações específicas de framework que o pipeline nativo aplica e um
build via Docker não teria automaticamente) — trocar o pipeline nativo por Docker
custaria as próprias vantagens que motivaram a escolha da Vercel deste projeto, para
não ganhar nada em troca.

## Consequências

**Positivas**

- Zero infraestrutura para provisionar manualmente: `DATABASE_URL` (Neon) e
  `BLOB_READ_WRITE_TOKEN` (Blob) são injetadas automaticamente ao conectar as
  integrações na aba "Storage" do projeto — só `AUTH_SECRET` e `DIRECT_DATABASE_URL`
  precisam de configuração manual (checklist completo na seção "Deploy" do
  `README.md`).
- Preview deployment por PR "de fábrica", sem workflow de CI adicional para criar ou
  destruir ambientes.
- HTTPS, CDN de assets e detecção de framework resolvidos pela plataforma, sem
  configuração própria.
- O `Dockerfile` e o job `docker` do CI continuam tendo valor real e não deixam de ser
  mantidos: são a prova de portabilidade (item `#7` da matriz) e a rede de segurança
  caso um dia seja necessário migrar de provedor — a imagem já validada a cada PR reduz
  o risco dessa migração hipotética.

**Negativas e dívidas conhecidas**

- **Vendor lock-in parcial de infraestrutura.** A escolha se apoia nas integrações
  nativas Vercel↔Neon e Vercel↔Blob — migrar de provedor de hospedagem exigiria
  reconectar (ou substituir) as duas peças de armazenamento, não é uma troca de um
  parâmetro só. Mitigado pela camada `infra/` (ADR 001): o código de acesso a
  banco/storage já vive isolado detrás de ports, então a troca fica restrita a
  `infra/`, não espalhada pelos use-cases.
- **Dois pipelines de build a manter em paralelo** (`vercel.json#buildCommand` e o
  `Dockerfile`) — uma mudança no processo de build (ex.: um novo passo antes do
  `next build`) precisa ser replicada nos dois lugares manualmente, ou o `Dockerfile`
  fica desatualizado silenciosamente em relação ao que realmente roda em produção. Hoje
  os dois pipelines fazem essencialmente a mesma sequência (`prisma generate` →
  `migrate deploy` → `next build`), então o risco de divergência é baixo, mas não é
  verificado automaticamente por nenhum teste.
- **Free tier do Neon tem cold start.** A ressalva já conhecida para o ambiente de
  desenvolvimento vale também para produção no free tier: a primeira requisição depois
  de um período de inatividade paga uma latência extra para o banco "acordar". Mitigação hoje: nenhuma automatizada — fica
  registrado como conhecido, não como resolvido.
- **A prova de portabilidade do Docker nunca é exercitada com o Postgres real de
  produção (Neon)** — o smoke test do job `docker` sobe contra um Postgres efêmero do
  próprio CI (serviço `postgres:16-alpine`), não contra o Neon. Uma migração real para
  container em produção precisaria validar a conexão com Neon separadamente (SSL,
  connection string no formato que o Neon exige) antes de virar o caminho de deploy de
  fato.
