# Roteiro de apresentação — Resolve Aí

Roteiro prático para uma demonstração/vídeo de poucos minutos, seguindo a matriz de
rastreabilidade (seção 1 do `docs/PLANO.md` / seção "Matriz de rastreabilidade" do
`README.md`) como estrutura — uma seção por linha da matriz, agrupando linhas
relacionadas quando faz sentido mostrar juntas. Para cada ponto: **o que mostrar** (tela/
URL específica), **o que dizer** (2–3 frases-guia, não um script palavra por palavra) e
**tempo sugerido**. Soma total: **≈ 9–11 minutos** — ajustável cortando as seções
marcadas como opcionais primeiro se precisar encurtar.

**Preparação antes de gravar:** suba o app numa porta dedicada, nunca a `3000` (pode
estar ocupada por outro processo na máquina de quem grava) — ex.
`PORT=3100 npm run dev` — com o banco já migrado e populado (`npm run db:seed`). Tenha
duas sessões de navegador abertas (ou uma normal + uma anônima): uma logada como
`gestor1@resolveai.com`, outra como `ana@resolveai.com` (senha `Senha@123` para ambos —
ver "Usuários de seed" no `README.md`), para não perder tempo trocando de login ao vivo.

---

## 1. Abertura + arquitetura (matriz #1, #9) — ~2 min

**O que mostrar:**

1. `README.md` no GitHub (ou editor) — rolar até a seção "Matriz de rastreabilidade" por
   1–2 segundos, só para situar que a apresentação segue essa régua.
2. `docs/arquitetura.md` — o diagrama de contexto/container (C4) primeiro.
3. O diagrama de camadas (`domain` → `application` → `infra`), no mesmo arquivo.

**O que dizer:**

- "O Resolve Aí é um Next.js 15 fullstack — um único processo para UI e API, decisão
  registrada na ADR 001: o critério de avaliação é separação de responsabilidades, não
  quantidade de processos, e isso vem de camadas dentro do repositório, não de dois
  serviços separados."
- "Dentro de cada módulo — aqui, `occurrence` — o domínio não importa nada de fora: nem
  Next, nem Prisma. É por isso que a máquina de estados é testável em milissegundos, sem
  banco. O Route Handler só chama a `application/`, nunca a `infra/` ou o Prisma direto."
- "Auth.js roda dentro do próprio processo — não é uma caixa externa no diagrama de
  contexto; é biblioteca, não serviço."

**Nota:** ADRs 002, 003, 004, 005 e 006 existem e valem a leitura, mas citar todas ao
vivo alongaria demais a abertura — mencione que existem (`docs/adr/001` a `006`) e
aponte para elas como referência, sem abrir cada uma.

---

## 2. Fluxo completo de uma ocorrência (matriz #2, #5) — ~4 min

O núcleo da demonstração — a jornada write-once que prova backend, frontend e a máquina
de estados funcionando de ponta a ponta. Três etapas, atravessando os dois papéis do
sistema (**Solicitante** cria e depois avalia; **Gestor** conduz a gestão no meio):

### 2.1 Criação (Solicitante) — ~1 min

**O que mostrar:** logado como `ana@resolveai.com`, tela `/ocorrencias/nova` —
preencher título, descrição, categoria, localização, e fazer upload de uma imagem
(preview aparecendo antes de enviar). Submeter e cair no detalhe (`/ocorrencias/[id]`)
com o protocolo gerado (`OC-2026-NNNNNN`) e status `ABERTA`.

**O que dizer:**

- "Qualquer usuário autenticado cria uma ocorrência — categoria, localização e foto
  opcional. O protocolo e o status inicial (`ABERTA`) são fixados pelo servidor, nunca
  recebidos do cliente."
- "A entrada inicial do histórico já nasce junto com a ocorrência, na mesma transação de
  banco — ADR 005: nunca existe uma ocorrência sem pelo menos uma entrada de histórico."

### 2.2 Gestão (Gestor) — ~2 min

**O que mostrar:** trocar para `gestor1@resolveai.com`, abrir o backlog (`/ocorrencias`),
filtrar pela ocorrência recém-criada, abrir o detalhe de gestão. Definir prioridade
`ALTA`, atribuir um responsável, e então conduzir as transições ao vivo:
`ABERTA → EM_ANALISE → EM_ATENDIMENTO → RESOLVIDA`, preenchendo a observação obrigatória
em cada transição e o campo de solução (`resolutionNote`) na transição final para
`RESOLVIDA`. Abrir a timeline e mostrar as 4 entradas em ordem.

**O que dizer:**

- "Só o Gestor muda prioridade, atribui responsável e transiciona status — e a checagem
  de papel acontece no use-case, não só na tela: um Solicitante que tentasse chamar a
  mesma rota de API receberia 403, mesmo sem ver este botão na UI."
- "Cada transição exige observação; resolver exige também a solução aplicada. A
  auditoria fica na timeline — quem mudou o quê e quando, sem buraco."

### 2.3 Avaliação (Solicitante) — ~1 min

**O que mostrar:** voltar para a sessão de `ana@resolveai.com`, abrir a mesma ocorrência
(agora `RESOLVIDA`) e mostrar o card de avaliação — nota (1–5 estrelas) e comentário
opcional. Enviar e mostrar a nota refletida no detalhe.

**O que dizer:**

- "Só o autor avalia, e só depois de `RESOLVIDA` — uma vez por ocorrência. Essa nota
  alimenta o indicador de satisfação do dashboard, próxima seção."

---

## 3. Dashboard do Gestor (matriz #5) — ~1min30

**O que mostrar:** `/dashboard`, logado como Gestor — os cards de KPI, o gráfico de
status, o gráfico por categoria, a série temporal de abertura×resolução e o indicador de
nota média. Passar o mouse sobre um gráfico para mostrar o tooltip.

**O que dizer:**

- "Indicadores reais, calculados a partir dos dados de seed: total por status, por
  categoria, por prioridade, tempo médio de resolução e a série temporal dos últimos 30
  dias. Só o Gestor vê esta tela — `requireRole('GESTOR')` no endpoint de métricas."

---

## 4. API, contrato e testes (matriz #3, #6) — ~2 min

**O que mostrar:**

1. `/api/docs` no navegador — a UI Scalar, mostrando 2-3 operações expandidas (ex.
   `POST /occurrences` e `POST /occurrences/{id}/status`) com o esquema de
   request/response e os erros RFC 7807.
2. Terminal: `npm test` rodando ao vivo (406 testes, todos verdes) — ou, se o tempo for
   curto, um print/trecho do output já rodado.
3. (Opcional, se o tempo permitir) `npm run test:e2e` — pelo menos o início, mostrando o
   Playwright abrindo o browser e rodando a primeira jornada.

**O que dizer:**

- "O contrato OpenAPI 3.1 é gerado a partir dos mesmos schemas Zod que já validam as
  requisições em runtime — não é escrito à mão, então não pode divergir do código sem
  que alguém precise lembrar de atualizar um arquivo separado."
- "A pirâmide de testes: unitário (domínio e regras, sem banco), integração (rota real
  contra Postgres), e2e (as 3 jornadas completas no Playwright) — 406 testes, todos
  verdes, mais 3 specs de e2e e uma varredura de acessibilidade com axe-core."

---

## 5. Docker e CI/CD (matriz #7) — ~1 min

**O que mostrar:** `docker-compose.yml` e `Dockerfile` (abrir rapidamente, sem ler linha
a linha) + a aba "Actions" do GitHub, um PR recente com os 4 jobs verdes
(`quality`, `test`, `e2e`, `docker`).

**O que dizer:**

- "`docker compose up` sobe Postgres, banco de teste e a aplicação com um comando —
  ambiente de desenvolvimento sem instalar nada além de Docker. E o `Dockerfile`
  multi-stage é validado com build + smoke test real a cada PR, no job `docker` — prova
  de portabilidade, não é só um arquivo que existe sem ser testado."

---

## 6. Deploy (matriz #8) — ~1 min

Esta seção tem **duas versões** — use a que corresponder ao estado real no momento da
gravação:

**Se o deploy real já foi feito:** mostrar a URL pública, abrir `/api/v1/health` (deve
responder `{"status":"ok"}`), fazer login com um usuário de seed e navegar por 1-2 telas
para provar que está no ar de verdade, não só que builda.

**Se o deploy real ainda não foi feito** (estado no momento em que este roteiro foi
escrito): dizer isso explicitamente, sem maquiar — "o deploy em si é o próximo passo,
manual, fora desta sessão de trabalho" — e mostrar em vez disso:

- O job `docker` do CI verde (já mostrado na seção 5) como prova de que a aplicação
  builda e roda de ponta a ponta.
- A seção "Deploy (Vercel + Neon + Blob)" do `README.md` — o checklist completo de
  variáveis e passos, já pronto para quando o deploy acontecer.
- A [ADR 006](./adr/006-vercel-nao-docker-producao.md), rapidamente — por que Vercel, não
  o container, é o destino de produção planejado.

**O que dizer (versão "ainda não"):**

- "A infraestrutura de deploy está pronta e documentada — Vercel, Neon e Vercel Blob,
  com um checklist passo a passo — mas conectar o projeto e publicar é uma ação manual
  que ainda não foi executada. O que já está comprovado é que a aplicação builda e roda
  corretamente, via o job `docker` do CI."

---

## 7. Encerramento — ~30 s

**O que mostrar:** voltar para o `README.md`, seção "Matriz de rastreabilidade".

**O que dizer:**

- "Voltando à régua do início: [ler rapidamente o status de cada linha, ou resumir] —
  praticamente tudo entregue e comprovado no próprio repositório; o único item que
  depende de uma ação fora deste código é o deploy real, item 8."

---

## Referência rápida — tempos por seção

| Seção                           | Tempo         | Pode cortar se precisar?                       |
| ------------------------------- | ------------- | ---------------------------------------------- |
| 1. Abertura + arquitetura       | ~2 min        | Encurtar, não cortar                           |
| 2. Fluxo completo da ocorrência | ~4 min        | Núcleo — não cortar                            |
| 3. Dashboard                    | ~1min30       | Encurtar                                       |
| 4. API, contrato e testes       | ~2 min        | Cortar o e2e ao vivo primeiro                  |
| 5. Docker e CI/CD               | ~1 min        | Encurtar                                       |
| 6. Deploy                       | ~1 min        | Não cortar — é honestidade sobre o estado real |
| 7. Encerramento                 | ~30 s         | —                                              |
| **Total**                       | **~9–11 min** |                                                |
