# ADR 005 — Histórico transacional e 404 uniforme

- **Status:** aceita
- **Data:** 2026-09-06

## Contexto

O "Resolve Aí" precisa de um histórico auditável do ciclo de vida de cada ocorrência —
quem abriu, quem mudou o quê e quando. A tabela `StatusHistory` carrega isso, com uma
entrada por transição de status (`fromStatus` → `toStatus`).

Duas decisões de segurança e consistência de dados surgiram ao implementar
`POST /occurrences` e `GET /occurrences/:id`, e nenhuma das duas era óbvia o
suficiente para se justificar sozinha num comentário de código sem que a próxima pessoa
a questionasse:

1. **Consistência do histórico.** Toda ocorrência precisa nascer com pelo menos uma
   entrada de `StatusHistory` (`fromStatus: null`, `toStatus: 'ABERTA'`) — é o registro de
   quando e por quem ela foi aberta, e a timeline da tela de detalhe (`buildTimeline`)
   assume que essa entrada sempre existe. Um `INSERT` em `Occurrence` que tenha sucesso
   sem o `INSERT` correspondente em `StatusHistory` (por uma falha de rede, um erro não
   tratado, um `throw` no meio do caminho) deixaria uma ocorrência órfã de histórico —
   silenciosamente, porque nada no schema obriga essa relação a existir.

2. **`GET /occurrences/:id` em ocorrência de outra pessoa.** Um `SOLICITANTE`
   autenticado pode adivinhar ou enumerar `id`s de ocorrências que não são dele. A pergunta
   é o que a API responde: `403 Forbidden` (existe, mas você não pode ver) ou
   `404 Not Found` (como se não existisse)?

## Decisão

### Criação da ocorrência e da entrada inicial de histórico na mesma transação

`prismaOccurrenceRepository.create` (`src/modules/occurrence/infra/prisma-occurrence-repository.ts`)
envolve o `INSERT` em `Occurrence` e o `INSERT` inicial em `StatusHistory` num único
`prisma.$transaction`. Não existe caminho de código que grave uma ocorrência sem essa
entrada — se o segundo `INSERT` falhar, o primeiro é revertido pelo Postgres, e o
use-case (`createOccurrence`) recebe o erro para tratar (inclusive o retry de colisão de
`code`, ver seção "Alternativas consideradas").

A porta `OccurrenceRepository.create` documenta essa garantia no contrato (não é detalhe
de implementação): "não pode existir ocorrência sem essa entrada".

### 404 uniforme em vez de 403

`getOccurrence` (`src/modules/occurrence/application/get-occurrence.ts`) lança o mesmo
`NotFoundError` (404) tanto para "ocorrência não existe" quanto para "existe, mas
`canViewOccurrence` nega" (ex.: `SOLICITANTE` pedindo a ocorrência de outra pessoa). Um
`403` nesse segundo caso já seria, por si, um vazamento: confirmaria a existência de um
recurso que o ator não deveria saber que existe, permitindo enumerar `id`s válidos
mesmo sem nunca ver o conteúdo deles. Os dois casos produzem exatamente o mesmo
`status`/`code`/`title` — não há diferença de payload nem de tempo de resposta que
distinga "não existe" de "existe, mas não é seu".

A mesma rota (`src/app/(app)/ocorrencias/[id]/page.tsx`) trata os dois casos de forma
idêntica: `NotFoundError` vira `notFound()` do Next, renderizando a mesma tela de "não
encontrado" para ambos.

## Alternativas consideradas

**Duas escritas separadas (ocorrência, depois histórico) com compensação manual em caso
de falha.** Reimplementaria à mão o que uma transação de banco já garante, com mais
código e mais chance de esquecer um caminho de erro.

**403 para "existe mas não é sua", 404 só para "não existe".** Mais informativo para
quem tem acesso legítimo, mas exatamente esse detalhe extra é o vazamento: distingue as
duas respostas para quem não deveria receber nenhuma pista. Rejeitada por segurança, não
por simplicidade.

**Retry de colisão de `code` fora da transação de criação.** `createOccurrence` já lida
com a corrida de dois `POST /occurrences` simultâneos calculando o mesmo `code`
(`nextSequenceForYear` lido por ambos antes de qualquer `create` confirmar): o
`prismaOccurrenceRepository.create` traduz a violação da constraint `@unique` de `code`
(P2002) em `OccurrenceCodeConflictError`, e o use-case recalcula a sequência e tenta de
novo (até 5 tentativas). Isso fica dentro do mesmo desenho desta ADR porque o retry só
existe **porque** `create` é atômico: uma falha no meio da transação (incluindo a
colisão de `code`) nunca deixa um registro parcial para trás, então tentar de novo do
zero é seguro.

## Consequências

**Positivas**

- Nunca existe uma ocorrência sem ao menos uma entrada de histórico — a timeline da tela
  de detalhe não precisa tratar esse caso como possível.
- Enumeração de `id` não confirma existência de ocorrência alheia: o `SOLICITANTE` que
  tenta acessar o registro de outra pessoa recebe a mesma resposta de "não existe".
- O retry de colisão de `code` é seguro por construção: a transação garante que uma
  tentativa falha não deixa rastro no banco.

**Negativas e dívidas conhecidas**

- **Uma consulta extra por criação.** A transação faz dois `INSERT`s em vez de um; o
  custo é uma escrita a mais por ocorrência criada, aceitável dado o volume esperado.
- **404 uniforme também esconde o motivo de um bug.** Se `canViewOccurrence` tiver uma
  regra errada negando acesso a quem deveria poder ver, o sintoma observado é "ocorrência
  não encontrada" — mais difícil de diagnosticar em produção do que um 403 explícito
  seria. Mitigação: a regra de autorização está isolada e testada em
  `domain/permissions.ts` e `get-occurrence.test.ts`, cobrindo os dois casos que
  precisam colapsar na mesma resposta.
- **`GET /occurrences/:id/history` não existe ainda** — quando existir, precisa da mesma
  checagem de `canViewOccurrence` e do mesmo 404 uniforme, ou reabre a mesma questão de
  enumeração por outra rota.
