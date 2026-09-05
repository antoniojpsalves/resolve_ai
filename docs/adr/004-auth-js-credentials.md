# ADR 004 — Auth.js v5 com provider Credentials e sessão JWT

- **Status:** aceita
- **Data:** 2026-09-04

## Contexto

O "Resolve Aí" precisa autenticar usuários e distinguir dois papéis — `SOLICITANTE` e
`GESTOR` — que veem telas e dados diferentes. A autorização não pode viver só na UI: um
`SOLICITANTE` que digite `/dashboard` na barra de endereços tem de ser barrado no servidor.

Restrições do projeto:

- é uma aplicação Next.js 15 fullstack (App Router), sem backend separado;
- o cadastro é público e feito com e-mail e senha — não há provedor de identidade
  corporativo, nem exigência de login social;
- o schema já modela o papel diretamente no usuário (`User.role`);
- a API é versionada em `/api/v1`, e a autenticação não pode ser exceção a essa regra;
- o prazo é curto e a superfície de segurança precisa ser pequena e auditável.

## Decisão

Usamos **Auth.js v5 (`next-auth@5.0.0-beta`)** com o provider **Credentials** e sessão em
**JWT**, carregando `id` e `role` dentro do token.

Pontos concretos da implementação:

- **`basePath: '/api/v1/auth'`** — os endpoints do Auth.js seguem o mesmo versionamento do
  resto da API. O cliente `next-auth/react` recebe o mesmo `basePath` via `SessionProvider`
  (`src/app/providers.tsx`), já que seu padrão seria `/api/auth`.
- **Sessão JWT, sem adapter de banco.** Não há tabela de sessão: o papel viaja assinado no
  cookie e é lido sem ida ao banco a cada requisição.
- **Configuração dividida em duas metades.** `src/auth.config.ts` é _edge-safe_ (só tipos e
  callbacks) e alimenta o `src/middleware.ts`; `src/auth.ts` acrescenta o provider
  Credentials, que usa Prisma e bcryptjs e portanto só roda no runtime Node.
- **Hash de senha reutilizado.** O `authorize` chama `verifyPassword` de
  `src/modules/identity/infra/password.ts` — o mesmo módulo usado pelo seed e pelo cadastro.
  Há um único caminho de hash no projeto (bcryptjs, cost 10).
- **Regra de autenticação na camada de aplicação.** O `authorize` do provider é só
  transporte: valida a forma do payload e delega ao use-case `authenticateUser`
  (`src/modules/identity/application/authenticate-user.ts`), que recebe as ports
  `UserRepository` e `PasswordVerifier`. A regra mais sensível do sistema é testável sem
  subir o Next e usa o mesmo repositório do cadastro.
- **Resposta uniforme na falha — no corpo e no tempo.** Payload inválido, e-mail
  inexistente e senha errada retornam exatamente o mesmo erro genérico
  (`CredentialsSignin`). Isso, sozinho, não bastava: retornar cedo quando o e-mail não
  existe deixava um **oráculo de temporização**. O caminho "e-mail cadastrado, senha
  errada" executava um bcrypt de cost 10 (~58 ms) e o caminho "e-mail inexistente" não
  executava nenhum (~3 ms) — uma diferença estável de ~20x, suficiente para enumerar
  contas cronometrando as respostas.
  A defesa é comparar a senha informada contra um hash bcrypt constante de mesmo cost
  (`DUMMY_PASSWORD_HASH`, no próprio use-case) quando o usuário não é encontrado,
  descartando o resultado. Os dois caminhos passam a executar exatamente um bcrypt de
  cost 10 e a custar o mesmo tempo (medido: 58 ms vs 57 ms). O cost do hash dummy
  precisa acompanhar o `SALT_ROUNDS` de `infra/password.ts`, ou o oráculo reabre.
- **Guardas no servidor.** `requireSession()` e `requireRole(role)`, em
  `src/core/http/auth-guards.ts`, lançam `UnauthorizedError` (401) e `ForbiddenError` (403).
  São chamadas em layouts e Server Components — o middleware é conveniência de UX, não a
  fronteira de autorização.

## Alternativas consideradas

**OAuth / login social (Google, GitHub).** O Auth.js tornaria isso quase gratuito, mas o
público do produto é o morador ou o colaborador de um condomínio/empresa; exigir conta
Google adiciona uma dependência externa e um cadastro que a organização não controla.
Fica registrado como extensão futura barata: basta acrescentar o provider, já que a
sessão e o RBAC não mudam.

**Autenticação própria (cookie de sessão assinado à mão).** Menos dependências, porém
significa escrever CSRF, rotação de cookie, expiração e callbacks de sessão do zero —
exatamente o tipo de código onde um erro sutil vira vulnerabilidade.

**Sessão em banco (adapter Prisma).** Permite revogar uma sessão específica no servidor e
refletir mudança de papel imediatamente. Custa uma consulta por requisição e três tabelas
a mais. Para o escopo atual, o ganho não compensa; a decisão é reversível trocando
`strategy` e plugando o `@auth/prisma-adapter`.

**Auth.js v4.** Estável, mas não integra bem com o App Router nem com o middleware
declarativo do Next 15, e não oferece `basePath` configurável do jeito que precisamos.

## Consequências

**Positivas**

- Fluxo de credenciais, CSRF e cookies tratados por uma biblioteca revisada pela comunidade.
- Autenticação e cadastro compartilham o mesmo `UserRepository`, e ambos são testáveis com
  um repositório fake em memória — sem banco e sem servidor.
- `role` disponível no middleware, nos Server Components e nos route handlers sem consulta
  ao banco.
- Autenticação sob `/api/v1/auth/*`, coerente com o contrato de API.
- Abrir para OAuth depois é acrescentar um provider, não reescrever a autenticação.

**Negativas e dívidas conhecidas**

- **Dependemos de uma versão beta.** O Auth.js v5 ainda não teve release estável; a API
  pode mudar entre betas. Mitigação: a versão está no `package-lock.json` e o uso está
  concentrado em três arquivos (`auth.config.ts`, `auth.ts`, `middleware.ts`).
- **Sessão JWT não é revogável.** Uma mudança de papel só vale a partir do próximo login
  (ou da expiração do token). Se o produto passar a exigir revogação imediata, o caminho é
  migrar para sessão em banco.
- **`AUTH_SECRET` é infraestrutura crítica.** Trocá-lo invalida todas as sessões; vazá-lo
  permite forjar tokens com `role: GESTOR`. Precisa ser um segredo real em produção — o
  valor do `.env.example` é só para desenvolvimento.
- **Provider Credentials exige o runtime Node**, o que impede rodar a verificação de senha
  no edge e obriga a divisão em `auth.config.ts` / `auth.ts`.
- **O papel fica congelado no token.** `role` é gravado no JWT no momento do login e lido
  de lá em todo lugar — inclusive pelo `requireRole` do servidor, que **não** consulta o
  banco. Consequência prática: um GESTOR rebaixado a SOLICITANTE no banco continua com
  acesso de GESTOR até o token expirar (30 dias, o padrão do Auth.js) ou até fazer login
  de novo. Uma revogação imediata exigiria consultar o papel no banco a cada requisição
  ou migrar para sessão em banco — as duas opções estão descritas acima.
- **Não há rate limiting.** Nem em `POST /api/v1/auth/register`, nem em
  `POST /api/v1/auth/callback/credentials`. Hoje nada impede força bruta de senha ou
  criação em massa de contas: o custo do bcrypt (cost 10, ~58 ms) atrasa um atacante, mas
  não é um limite. Fora do escopo do Dia 1, mas **pendência obrigatória antes do deploy do
  Dia 4** — deve entrar junto com a configuração de produção, provavelmente como limite por
  IP + por e-mail no middleware ou numa camada à frente da aplicação.
