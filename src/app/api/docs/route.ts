import { ApiReference } from '@scalar/nextjs-api-reference';

import { generateOpenApiDocument } from '@/core/openapi/document';

/**
 * `GET /api/docs` — UI de documentação da API (Scalar), servindo o contrato
 * OpenAPI 3.1 gerado a partir dos schemas Zod (`src/core/openapi/`).
 *
 * **Pública de propósito**: documentação de API não exige sessão — não há
 * `requireSession`/`requireRole` aqui, ao contrário de toda rota de negócio
 * sob `/api/v1/**`. Não usa o wrapper `route()` de `core/http/handler.ts`
 * (esse é para rotas de negócio que podem lançar `AppError`/`ZodError`;
 * esta rota não lança nada que precise virar problem+json).
 *
 * `content` recebe uma função (não o objeto já calculado) para o documento
 * ser gerado a cada requisição, nunca cacheado num module-scope stale — ver
 * a nota de decisão em `src/core/openapi/document.ts` sobre por que a rota
 * gera em runtime em vez de ler um `openapi.json` estático.
 */
export const GET = ApiReference({
  content: () => generateOpenApiDocument(),
  pageTitle: 'Resolve Aí — API Docs',
});
