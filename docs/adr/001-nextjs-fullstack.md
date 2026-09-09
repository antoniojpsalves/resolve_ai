# ADR 001 — Next.js fullstack, não Next.js + NestJS separado

- **Status:** aceita
- **Data:** 2026-09-04 (decisão anterior ao primeiro commit; formalizada como ADR
  posteriormente)

> **Nota:** esta ADR e a 003 formalizam decisões que já estavam em vigor desde a primeira
> linha de código — a numeração ficou reservada desde o início e só depois virou arquivo
> próprio. O conteúdo abaixo não é uma mudança de rumo nem uma decisão nova.

## Contexto

O desafio pede uma plataforma completa (autenticação, CRUD de ocorrências, máquina de
estados com histórico, dashboard com indicadores, upload de imagem) entregue por uma
pessoa em 5 dias, com avaliação em cima de arquitetura, qualidade de backend, API,
frontend, testes, Docker, deploy e documentação — nove frentes, um único desenvolvedor,
sem folga de cronograma para retrabalho.

Duas formas de organizar front-end e back-end estavam na mesa antes do primeiro commit:

1. **Next.js fullstack** — um único projeto, front-end (App Router, Server Components)
   e API (`Route Handlers` em `src/app/api/**`) no mesmo processo e no mesmo deploy.
2. **Next.js (front) + NestJS (back) separados** — dois projetos, dois `package.json`,
   comunicação via HTTP entre eles, cada um com seu próprio pipeline de build/deploy.

A pergunta que decide entre as duas não é "qual framework de backend é melhor" — é
"o que o enunciado cobra quando fala em arquitetura": separação de responsabilidades e
testabilidade, não contagem de processos ou de repositórios. Nenhuma parte do desafio
exige um consumidor de API diferente do próprio front-end (não
há app mobile nem um segundo cliente), o que é o cenário em que dois serviços separados
pagaria pelo próprio benefício (times diferentes, ciclos de deploy independentes,
escalabilidade horizontal desacoplada do front).

## Decisão

Adotamos **Next.js 15 fullstack**: um único projeto, front-end e back-end no mesmo
processo, com o back-end exposto como `Route Handlers` REST versionados em `/api/v1`
(`src/app/api/v1/**`).

A separação de responsabilidades que a arquitetura em duas camadas de serviço daria vem,
neste projeto, de **camadas dentro do mesmo repositório**, não de processos diferentes:

```
src/modules/<contexto>/
├─ domain/        entidades, enums, máquina de estados, regras — sem nenhuma lib externa
├─ application/   use-cases (recebem ports/interfaces, nunca o Prisma diretamente)
└─ infra/         implementação concreta dos ports (Prisma, storage de arquivo)
```

O `Route Handler` é só transporte: valida o payload com Zod, chama um use-case de
`application/`, traduz o retorno/erro para HTTP. Ele nunca importa `infra/` ou o Prisma
diretamente — a mesma fronteira que separaria "serviço de API" de "serviço de domínio"
em dois processos existe aqui como fronteira de importação entre pastas, imposta por
convenção e por revisão (não há, hoje, um lint rule automatizado que bloqueie a
violação — ver "Consequências"). O diagrama de camadas em `docs/arquitetura.md` detalha
essa direção de dependência.

## Alternativas consideradas

**Next.js + NestJS separados.** Dois processos, dois deploys, dois pipelines de CI,
tipos duplicados entre front e back (ou um pacote compartilhado a mais para manter) e
CORS a configurar e testar — nenhum desses custos compra algo que o desafio avalie. O
único ganho real seria um limite de processo mais rígido entre "camada HTTP" e "camada
de domínio", que aqui é obtido de outra forma (regra de importação entre pastas +
`domain/` sem nenhuma dependência de framework). Rejeitada: o custo de coordenação de
dois serviços não se paga em 5 dias com um único desenvolvedor, e o critério de avaliação
é separação de responsabilidades, não separação de processos.

**Next.js + rotas de API "soltas" (sem camadas internas).** A opção mais rápida de
todas — Route Handlers chamando o Prisma direto, sem `domain/`/`application/`/`infra/`.
Rejeitada porque devolveria exatamente o problema que a exigência de arquitetura existe
para evitar: nenhuma testabilidade de unidade (a máquina de estados dependeria de banco
para ser testada),
nenhuma fronteira de responsabilidade visível no código, e um refactor para introduzir
camadas depois do MVP custaria mais do que introduzi-las desde o início.

**BFF (Backend for Frontend) separado do domínio.** Um meio-termo — um serviço fino de
composição na frente de um "core" — que faz sentido quando há múltiplos front-ends
(web, mobile) com necessidades de agregação diferentes. Não é o caso aqui: há um único
cliente (o próprio Next.js), então o BFF colapsaria no mesmo processo do front de
qualquer forma. Descartada por não haver o problema que ela resolve.

## Consequências

**Positivas**

- Um único deploy (Vercel), sem CORS, sem duplicação de tipos entre "contrato do back"
  e "tipos do front" — o mesmo `application/*.ts` que valida a requisição no servidor é
  importado (tipo, não runtime) por quem constrói o formulário no cliente.
- `domain/` testável em milissegundos, sem servidor HTTP nem banco — a máquina de
  estados (`docs/adr/005-historico-transacional.md` documenta parte dela) e as regras de
  permissão são Vitest puro.
- Um único pipeline de CI (`.github/workflows/ci.yml`) e um único artefato de deploy —
  metade da superfície operacional de manter em 5 dias, comparado a dois serviços.
- A fronteira de camadas é reversível na direção "separar depois": se o produto
  crescesse e precisasse de um segundo consumidor (app mobile nativo, por exemplo), a
  camada `application/` já não depende de Next nem de Prisma — extraí-la para um serviço
  próprio seria mover pastas, não reescrever regras de negócio.

**Negativas e dívidas conhecidas**

- **A fronteira entre camadas não é imposta por ferramenta, só por convenção e revisão.**
  Não há uma regra de ESLint (`eslint-plugin-boundaries` ou similar) que bloqueie um
  `Route Handler` importando `infra/` diretamente, ou um arquivo em `domain/` importando
  o Prisma. Hoje isso é mantido só por disciplina ao escrever/revisar cada rota — uma
  dívida aceitável no prazo do desafio, mas o primeiro item a automatizar se o projeto
  continuasse.
- **Escalabilidade horizontal do "back" e do "front" está acoplada.** Em dois serviços
  separados, cada um escalaria independentemente. Aqui, front e API escalam juntos (o
  runtime serverless da Vercel escala por invocação, o que mitiga bastante isso na
  prática, mas é uma opção que se perde deliberadamente).
- **Um único `package.json`/lockfile para tudo.** Uma dependência usada só pela API
  (ex. uma lib de geração de PDF, hipoteticamente) infla o mesmo grafo de dependências
  que o front carrega para build — não afeta o bundle do cliente (código de servidor não
  é enviado ao browser pelo Next), mas afeta tempo de instalação e de build.
