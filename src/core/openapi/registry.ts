import { z } from 'zod';

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import './zod-extend';

import { authenticateUserSchema } from '@/modules/identity/application/authenticate-user';
import { registerUserSchema } from '@/modules/identity/application/register-user';
import { addCommentSchema } from '@/modules/occurrence/application/add-comment';
import { changeOccurrenceStatusSchema } from '@/modules/occurrence/application/change-occurrence-status';
import { createOccurrenceSchema } from '@/modules/occurrence/application/create-occurrence';
import { dashboardMetricsQuerySchema } from '@/modules/occurrence/application/get-dashboard-metrics';
import { listOccurrencesQuerySchema } from '@/modules/occurrence/application/list-occurrences';
import { rateOccurrenceSchema } from '@/modules/occurrence/application/rate-occurrence';
import { updateOccurrenceManagementSchema } from '@/modules/occurrence/application/update-occurrence-management';

import {
  categorySummarySchema,
  commentEntrySchema,
  dashboardMetricsSchema,
  healthResponseSchema,
  listOccurrencesResponseSchema,
  occurrenceDetailSchema,
  occurrenceRecordSchema,
  problemDetailsSchema,
  publicUserSchema,
  ratingEntrySchema,
  statusHistoryEntrySchema,
  storedFileSchema,
} from './schemas';

/**
 * Registro central do contrato OpenAPI 3.1, gerado a partir dos schemas Zod
 * que já existem em `application/`.
 *
 * Nenhum schema Zod original é modificado aqui — só importado e, quando
 * precisa de metadado (título, exemplo), envolvido com `.openapi(...)`, que
 * devolve um clone (ver comentário em `./zod-extend.ts`).
 *
 * Cobre **todas as rotas reais** do projeto (`find src/app/api -name route.ts`,
 * conferidas uma a uma): 12 rotas de negócio + o catch-all do Auth.js.
 */
export function buildOpenApiRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  // ---------------------------------------------------------------------
  // Segurança: sessão do Auth.js via cookie — não é uma API key de verdade,
  // mas `apiKey`/`in: cookie` é o único tipo de securityScheme do OpenAPI
  // que descreve "um valor lido de um cookie nomeado" (não há tipo
  // `session`/`cookie` dedicado na spec). O nome deixa claro que é sessão.
  // ---------------------------------------------------------------------
  const sessionCookieAuth = registry.registerComponent('securitySchemes', 'sessionCookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: 'authjs.session-token',
    description:
      'Cookie de sessão do Auth.js (NextAuth v5) — **não é uma API key**. ' +
      'Definido no login via `POST /api/v1/auth/callback/credentials` (fluxo padrão do ' +
      'Auth.js, ver rota `/api/v1/auth/[...nextauth]`). Em produção (HTTPS) o navegador ' +
      'recebe o cookie com o nome `__Secure-authjs.session-token` em vez deste.',
  });
  const requireSessionCookie = [{ [sessionCookieAuth.name]: [] }];

  // ---------------------------------------------------------------------
  // Erros comuns RFC 7807, reutilizados por referência (`$ref`) em cada rota
  // em vez de repetidos — `src/core/http/problem.ts` monta exatamente este
  // formato para qualquer `AppError`/`ZodError` lançado por um use-case.
  //
  // `registerComponent('responses', ...)` espera um `ResponseObject` **cru**
  // do `openapi3-ts` — diferente de `registerPath`, ele não aceita um schema
  // Zod embutido em `content`. Por isso registramos `ProblemDetails` como
  // componente de schema primeiro (`registry.register`) e referenciamos o
  // `$ref` resultante nos responses compartilhados; usos inline de erro que
  // não passam por `registerComponent` (413 de upload, 503 do health)
  // continuam usando `problemDetailsSchema` (Zod) diretamente — ver
  // `problemInlineResponse` mais abaixo.
  // ---------------------------------------------------------------------
  registry.register('ProblemDetails', problemDetailsSchema);
  const problemDetailsRef = { $ref: '#/components/schemas/ProblemDetails' };

  const problemComponentResponse = (description: string) => ({
    description,
    content: { 'application/problem+json': { schema: problemDetailsRef } },
  });

  const unauthorized = registry.registerComponent(
    'responses',
    'UnauthorizedError',
    problemComponentResponse('Sem sessão ativa — cookie de sessão ausente ou expirado.'),
  );
  const forbidden = registry.registerComponent(
    'responses',
    'ForbiddenError',
    problemComponentResponse('Autenticado, mas sem permissão para esta ação.'),
  );
  const notFound = registry.registerComponent(
    'responses',
    'NotFoundError',
    problemComponentResponse(
      'Recurso inexistente — ou existente mas fora do escopo de quem pergunta (ver nota de ' +
        '404 uniforme nas rotas de ocorrência: "não existe" e "existe mas não é seu" são ' +
        'deliberadamente indistinguíveis).',
    ),
  );
  const conflict = registry.registerComponent(
    'responses',
    'ConflictError',
    problemComponentResponse('Conflito com o estado atual do recurso (ex.: e-mail já cadastrado).'),
  );
  const validation = registry.registerComponent(
    'responses',
    'ValidationError',
    problemComponentResponse(
      'Payload sintaticamente inválido (`ZodError`, 422 com `errors`) ou semanticamente ' +
        'recusado pela regra de negócio (ex.: transição de status exige campo obrigatório).',
    ),
  );

  /** Resposta de erro inline (não referenciada por `$ref`) — casos de uma rota só. */
  const problemInlineResponse = (description: string) => ({
    description,
    content: { 'application/problem+json': { schema: problemDetailsSchema } },
  });

  const commonErrors = {
    401: unauthorized.ref,
    403: forbidden.ref,
    404: notFound.ref,
    409: conflict.ref,
    422: validation.ref,
  } as const;

  const idParam = z.object({
    id: z.string().openapi({
      description: 'ID (cuid) da ocorrência.',
      example: 'clx1a2b3c4d5e6f7g8h9',
    }),
  });

  // Registrado como componente para documentar a forma esperada pelo
  // `authorize(...)` do provider Credentials (`src/auth.ts`) — usado como body
  // de `POST /api/v1/auth/{nextauthAction}` (ação `callback/credentials`)
  // abaixo. O login em si é 100% Auth.js: este contrato só documenta a forma
  // do payload, não reimplementa a rota.
  const authenticateUserInputSchema = registry.register(
    'AuthenticateUserInput',
    authenticateUserSchema.openapi('AuthenticateUserInput'),
  );

  // ---------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/register',
    operationId: 'registerUser',
    tags: ['Auth'],
    summary: 'Cadastro público de usuário',
    description:
      'Cria um usuário com papel sempre `SOLICITANTE` — quem promove a `GESTOR` é o banco/' +
      'administração, nunca esta rota. E-mail duplicado → 409.',
    // Público de propósito — `security: []` (em vez de omitir o campo) deixa explícito que
    // não é um esquecimento: qualquer visitante pode se cadastrar.
    security: [],
    request: { body: { content: { 'application/json': { schema: registerUserSchema } } } },
    responses: {
      201: {
        description: 'Usuário criado.',
        content: { 'application/json': { schema: publicUserSchema } },
      },
      409: commonErrors[409],
      422: commonErrors[422],
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/auth/{nextauthAction}',
    operationId: 'authJsCatchAllGet',
    tags: ['Auth'],
    summary: 'Endpoints do Auth.js (gerenciados pelo Auth.js v5)',
    description:
      'Catch-all servido inteiramente pelo Auth.js v5 (`handlers` de `NextAuth(...)`, ' +
      '`src/auth.ts`) — sessão (`session`), CSRF (`csrf`), provedores (`providers`), início ' +
      'de login (`signin`), callback de login (`callback/credentials`) e logout (`signout`). ' +
      'Este projeto não redige um schema de request/response para essas ações — são contrato ' +
      'do próprio Auth.js, não deste time. Documentado aqui só para não faltar na lista de ' +
      'rotas: método real e corpo variam por ação, ver a documentação do Auth.js v5. Público: ' +
      '`session`/`csrf`/`providers`/`signin` não exigem sessão prévia (é justamente como se ' +
      'obtém uma).',
    security: [],
    request: { params: z.object({ nextauthAction: z.string() }) },
    responses: {
      200: {
        description:
          'Resposta específica da ação do Auth.js — formato definido por ele, não por este contrato.',
        content: { 'application/json': { schema: z.object({}).passthrough() } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/{nextauthAction}',
    operationId: 'authJsCatchAllPost',
    tags: ['Auth'],
    summary: 'Endpoints do Auth.js (gerenciados pelo Auth.js v5)',
    description:
      'Ver `GET /api/v1/auth/{nextauthAction}` — mesmo catch-all, verbo POST (ex.: `signin`, ' +
      '`signout`). Em `callback/credentials` (o efetivo "login"), o corpo esperado é o ' +
      'formato de `AuthenticateUserInput` abaixo (`email`, `password`).',
    security: [],
    request: {
      params: z.object({ nextauthAction: z.string() }),
      body: {
        required: false,
        content: { 'application/json': { schema: authenticateUserInputSchema } },
      },
    },
    responses: {
      200: {
        description:
          'Resposta específica da ação do Auth.js — formato definido por ele, não por este contrato.',
        content: { 'application/json': { schema: z.object({}).passthrough() } },
      },
    },
  });

  // ---------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/v1/categories',
    operationId: 'listCategories',
    tags: ['Categories'],
    summary: 'Lista categorias ativas',
    description: 'Catálogo ordenado por nome. Qualquer usuário autenticado pode listar.',
    security: requireSessionCookie,
    responses: {
      200: {
        description: 'Catálogo de categorias ativas.',
        content: {
          'application/json': { schema: z.object({ data: z.array(categorySummarySchema) }) },
        },
      },
      401: commonErrors[401],
    },
  });

  // ---------------------------------------------------------------------
  // Occurrences
  // ---------------------------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/v1/occurrences',
    operationId: 'listOccurrences',
    tags: ['Occurrences'],
    summary: 'Lista ocorrências (filtros, ordenação, paginação)',
    description:
      '`GESTOR` vê todas; `SOLICITANTE` vê apenas as próprias — recorte aplicado pelo ' +
      'use-case, não um filtro que o cliente possa desativar.',
    security: requireSessionCookie,
    request: { query: listOccurrencesQuerySchema },
    responses: {
      200: {
        description: 'Página de resultados.',
        content: { 'application/json': { schema: listOccurrencesResponseSchema } },
      },
      401: commonErrors[401],
      422: commonErrors[422],
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/occurrences',
    operationId: 'createOccurrence',
    tags: ['Occurrences'],
    summary: 'Cria uma ocorrência',
    description:
      'Qualquer usuário autenticado pode criar. `status` inicial sempre `ABERTA`, `priority` ' +
      'inicial sempre `MEDIA` — fixados pelo servidor, não recebidos do cliente. `imageKey` ' +
      '(não `imageUrl`) é o único campo de imagem aceito, ver `createOccurrenceSchema`. ' +
      '404 quando `categoryId` não existe ou aponta para categoria inativa.',
    security: requireSessionCookie,
    request: { body: { content: { 'application/json': { schema: createOccurrenceSchema } } } },
    responses: {
      201: {
        description: 'Ocorrência criada.',
        content: { 'application/json': { schema: occurrenceRecordSchema } },
      },
      401: commonErrors[401],
      404: commonErrors[404],
      422: commonErrors[422],
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/occurrences/{id}',
    operationId: 'getOccurrence',
    tags: ['Occurrences'],
    summary: 'Detalhe de uma ocorrência',
    description:
      'Inclui histórico, comentários e avaliação. Ocorrência inexistente e ocorrência de ' +
      'outra pessoa (para um `SOLICITANTE`) chegam como o mesmo 404 — de propósito, para não ' +
      'confirmar por enumeração de ID que uma ocorrência de outro usuário existe.',
    security: requireSessionCookie,
    request: { params: idParam },
    responses: {
      200: {
        description: 'Detalhe completo.',
        content: { 'application/json': { schema: occurrenceDetailSchema } },
      },
      401: commonErrors[401],
      404: commonErrors[404],
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/occurrences/{id}',
    operationId: 'updateOccurrenceManagement',
    tags: ['Occurrences'],
    summary: 'Gestão de uma ocorrência (prioridade e/ou responsável)',
    description:
      'Restrito a `GESTOR` (`canChangePriority`/`canAssignResponsible`). Não é uma transição ' +
      'de status — isso é `POST .../status`. Pelo menos um dos dois campos precisa vir no ' +
      'corpo (`updateOccurrenceManagementSchema.refine`); os dois juntos disparam duas ' +
      'chamadas em sequência.',
    security: requireSessionCookie,
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: updateOccurrenceManagementSchema } } },
    },
    responses: {
      200: {
        description: 'Ocorrência atualizada.',
        content: { 'application/json': { schema: occurrenceRecordSchema } },
      },
      401: commonErrors[401],
      403: commonErrors[403],
      404: commonErrors[404],
      422: commonErrors[422],
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/occurrences/{id}/status',
    operationId: 'changeOccurrenceStatus',
    tags: ['Occurrences'],
    summary: 'Muda o status de uma ocorrência',
    description:
      'Aplica a máquina de estados de `domain/transitions.ts`. `200`, não `201`: é ' +
      'atualização de um recurso existente. `note` é obrigatório para cancelar; ' +
      '`resolutionNote` é obrigatório para resolver — a ausência vira 422, não 409.',
    security: requireSessionCookie,
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: changeOccurrenceStatusSchema } } },
    },
    responses: {
      200: {
        description: 'Status alterado.',
        content: { 'application/json': { schema: occurrenceRecordSchema } },
      },
      401: commonErrors[401],
      403: commonErrors[403],
      404: commonErrors[404],
      409: commonErrors[409],
      422: commonErrors[422],
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/occurrences/{id}/history',
    operationId: 'getOccurrenceHistory',
    tags: ['Occurrences'],
    summary: 'Linha do tempo (histórico de status) de uma ocorrência',
    description: 'Recorte de `GET /occurrences/{id}` — só o array `history`, mesma autorização.',
    security: requireSessionCookie,
    request: { params: idParam },
    responses: {
      200: {
        description: 'Histórico em ordem cronológica crescente.',
        content: {
          'application/json': { schema: z.object({ data: z.array(statusHistoryEntrySchema) }) },
        },
      },
      401: commonErrors[401],
      404: commonErrors[404],
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/occurrences/{id}/comments',
    operationId: 'addComment',
    tags: ['Occurrences'],
    summary: 'Adiciona um comentário a uma ocorrência',
    security: requireSessionCookie,
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: addCommentSchema } } },
    },
    responses: {
      201: {
        description: 'Comentário criado.',
        content: { 'application/json': { schema: commentEntrySchema } },
      },
      401: commonErrors[401],
      404: commonErrors[404],
      422: commonErrors[422],
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/occurrences/{id}/rating',
    operationId: 'rateOccurrence',
    tags: ['Occurrences'],
    summary: 'Avalia uma ocorrência resolvida',
    description:
      'Só o autor da ocorrência, e só quando `status === RESOLVIDA`. `201`, não `200`: cria ' +
      'um recurso novo (a avaliação). Autor de outra pessoa → mesmo 404 uniforme; ' +
      '`status` não é `RESOLVIDA` ou já foi avaliada → 409.',
    security: requireSessionCookie,
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: rateOccurrenceSchema } } },
    },
    responses: {
      201: {
        description: 'Avaliação registrada.',
        content: { 'application/json': { schema: ratingEntrySchema } },
      },
      401: commonErrors[401],
      404: commonErrors[404],
      409: commonErrors[409],
      422: commonErrors[422],
    },
  });

  // ---------------------------------------------------------------------
  // Uploads
  // ---------------------------------------------------------------------
  registry.registerPath({
    method: 'post',
    path: '/api/v1/uploads',
    operationId: 'uploadImage',
    tags: ['Uploads'],
    summary: 'Envia uma imagem (upload)',
    description:
      'Multipart com um campo `file`. O formato é decidido pelos *magic bytes* do conteúdo ' +
      '(JPEG/PNG/WebP), nunca pelo `Content-Type` declarado — arquivo vazio ou de outro ' +
      'formato vira 422. Limite de 5 MB (413 acima disso). Devolve a `key` a passar em ' +
      '`imageKey` na criação da ocorrência — nunca uma URL diretamente.',
    security: requireSessionCookie,
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description: 'Arquivo de imagem (JPEG, PNG ou WebP), até 5 MB.',
                },
              },
              required: ['file'],
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Arquivo salvo.',
        content: { 'application/json': { schema: storedFileSchema } },
      },
      401: commonErrors[401],
      413: problemInlineResponse('Arquivo maior que o limite de 5 MB.'),
      422: commonErrors[422],
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/uploads/{key}',
    operationId: 'getUploadedFile',
    tags: ['Uploads'],
    summary: 'Serve um arquivo do storage local',
    description:
      'Só relevante em desenvolvimento/Docker (storage local) — em produção o Vercel Blob ' +
      'serve a imagem direto pela URL pública que ele mesmo devolve, sem passar por esta ' +
      'rota. `key` segue o padrão `^[a-f0-9-]+\\.(jpg|jpeg|png|webp)$`; qualquer chave fora ' +
      'desse padrão (tentativa de path traversal incluída) e qualquer arquivo inexistente ' +
      'devolvem o mesmo 404.',
    security: requireSessionCookie,
    request: {
      params: z.object({
        key: z.string().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg' }),
      }),
    },
    responses: {
      200: {
        description: 'Conteúdo binário da imagem — `Content-Type` reflete a extensão da chave.',
        content: {
          'image/jpeg': { schema: { type: 'string', format: 'binary' } },
          'image/png': { schema: { type: 'string', format: 'binary' } },
          'image/webp': { schema: { type: 'string', format: 'binary' } },
        },
      },
      401: commonErrors[401],
      404: commonErrors[404],
    },
  });

  // ---------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/v1/dashboard/metrics',
    operationId: 'getDashboardMetrics',
    tags: ['Dashboard'],
    summary: 'Indicadores gerenciais',
    description: 'Restrito a `GESTOR` (`requireRole`). `overdueDays` é opcional (default 7).',
    security: requireSessionCookie,
    request: { query: dashboardMetricsQuerySchema },
    responses: {
      200: {
        description: 'Indicadores agregados.',
        content: { 'application/json': { schema: dashboardMetricsSchema } },
      },
      401: commonErrors[401],
      403: commonErrors[403],
      422: commonErrors[422],
    },
  });

  // ---------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/v1/health',
    operationId: 'healthCheck',
    tags: ['Health'],
    summary: 'Health check',
    description:
      'Público — usado por um smoke test após o container subir. Toca o schema real ' +
      '(`SELECT 1 FROM "User" LIMIT 1`), não só a conexão. Sem parâmetros e sem corpo — não ' +
      'há caminho de erro do cliente (4xx); a única falha possível é do lado do servidor (503).',
    security: [],
    responses: {
      200: {
        description: 'Aplicação e banco disponíveis.',
        content: { 'application/json': { schema: healthResponseSchema } },
      },
      503: problemInlineResponse('Banco de dados inacessível ou sem o schema esperado.'),
    },
  });

  return registry;
}
