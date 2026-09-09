import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';

import { generateOpenApiDocument } from '@/core/openapi/document';

/**
 * Guarda de regressão do contrato OpenAPI: não reimplementa
 * o gerador, só garante que ele continua produzindo um documento válido e
 * continua cobrindo todas as rotas reais do projeto — se uma rota nova for
 * criada em `src/app/api/**` e esquecida aqui, ou se um `registerPath`
 * existente for removido por engano, este teste falha.
 */
describe('generateOpenApiDocument', () => {
  it('gera um documento OpenAPI 3.1 estruturalmente válido', async () => {
    // `structuredClone`: `SwaggerParser.validate` normaliza o objeto recebido:
    // testes seguintes usam sua própria chamada a `generateOpenApiDocument()`,
    // então isolar aqui evita qualquer acoplamento entre os testes.
    const document = structuredClone(generateOpenApiDocument());

    // `SwaggerParser.validate` resolve sem lançar quando o documento é um
    // OpenAPI válido — é a asserção em si; `OpenAPI.Document` é uma união de
    // v2/v3/v3.1 e só a 3.1 tem `.openapi`, então checamos por essa chave em
    // vez de acessar `.openapi` direto (TS não estreita a união sem guarda).
    const validated = await SwaggerParser.validate(document as never);

    expect('openapi' in validated && validated.openapi).toBe('3.1.0');
  });

  it('cobre todas as rotas reais do projeto (find src/app/api -name route.ts)', () => {
    const document = generateOpenApiDocument();

    const expectedPaths = [
      '/api/v1/auth/register',
      '/api/v1/auth/{nextauthAction}',
      '/api/v1/categories',
      '/api/v1/occurrences',
      '/api/v1/occurrences/{id}',
      '/api/v1/occurrences/{id}/status',
      '/api/v1/occurrences/{id}/history',
      '/api/v1/occurrences/{id}/comments',
      '/api/v1/occurrences/{id}/rating',
      '/api/v1/uploads',
      '/api/v1/uploads/{key}',
      '/api/v1/dashboard/metrics',
      '/api/v1/health',
    ].sort();

    expect(Object.keys(document.paths ?? {}).sort()).toEqual(expectedPaths);
  });

  it('marca rotas autenticadas com o securityScheme de cookie de sessão do Auth.js', () => {
    const document = generateOpenApiDocument();
    const occurrencesGet = document.paths?.['/api/v1/occurrences']?.get;

    expect(occurrencesGet?.security).toEqual([{ sessionCookieAuth: [] }]);
    expect(document.components?.securitySchemes?.sessionCookieAuth).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
    });
  });

  it('marca rotas públicas com `security: []` explícito, não omitido', () => {
    const document = generateOpenApiDocument();

    expect(document.paths?.['/api/v1/health']?.get?.security).toEqual([]);
    expect(document.paths?.['/api/v1/auth/register']?.post?.security).toEqual([]);
  });

  it('reutiliza os erros comuns (RFC 7807) como componentes referenciados', () => {
    const document = generateOpenApiDocument();

    for (const name of [
      'UnauthorizedError',
      'ForbiddenError',
      'NotFoundError',
      'ConflictError',
      'ValidationError',
    ]) {
      expect(document.components?.responses?.[name]).toMatchObject({
        content: { 'application/problem+json': { schema: expect.anything() } },
      });
    }

    // A rota de criação de ocorrência referencia o componente comum de 404 por `$ref`,
    // em vez de repetir o schema — é a garantia de que `registerComponent` está sendo
    // de fato usado por `registerPath`, não só declarado e ignorado.
    const createOccurrence = document.paths?.['/api/v1/occurrences']?.post;

    expect(createOccurrence?.responses?.['404']).toEqual({
      $ref: '#/components/responses/NotFoundError',
    });
  });
});
