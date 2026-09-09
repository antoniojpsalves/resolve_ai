import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { buildOpenApiRegistry } from './registry';

/**
 * Gera o documento OpenAPI 3.1 completo a partir do registro
 * (`buildOpenApiRegistry`).
 *
 * **Decisão de onde/quando gerar** (brief da Tarefa 3, Dia 5): esta função é
 * a única fonte de verdade, chamada em dois lugares que não podem divergir
 * entre si porque os dois chamam exatamente esta função:
 *
 *  1. `src/app/api/docs/route.ts` — chama em **runtime**, a cada requisição
 *     à página de documentação. Garante que a UI nunca fica desatualizada
 *     em relação ao código (o caso mais fácil de esquecer com um arquivo
 *     estático: mudar um schema Zod e esquecer de regerar o JSON).
 *  2. `scripts/generate-openapi.ts` — roda **uma vez, sob demanda**, grava
 *     `openapi.json` na raiz do repositório. Esse arquivo estático não é
 *     consumido pela aplicação (a rota `/api/docs` não lê dele) — existe só
 *     como artefato para ferramentas externas que precisam de um arquivo:
 *     `npx @redocly/cli lint openapi.json`, colar em
 *     `https://editor.swagger.io`, ou anexar a um relatório. Reexecute o
 *     script sempre que um schema Zod usado no contrato mudar.
 *
 * A alternativa considerada — gerar só o arquivo estático e servir só ele
 * também pela rota `/api/docs` — foi descartada: exigiria lembrar de rodar
 * o script antes de cada `next build`/deploy, ou automatizá-lo num hook de
 * build, para a UI não divergir do código. Chamar a mesma função nos dois
 * lugares é mais simples de manter (nada para lembrar de rodar) e o custo é
 * desprezível: a página de docs é uma rota de baixíssimo tráfego.
 */
export function generateOpenApiDocument() {
  const registry = buildOpenApiRegistry();
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Resolve Aí — API',
      version: '1.0.0',
      description:
        'Plataforma de gestão de ocorrências. Contrato gerado a partir dos schemas Zod já ' +
        'existentes em `application/` (não escrito à mão) — ver `src/core/openapi/`. Erros ' +
        'seguem RFC 7807 (`application/problem+json`). Projeto privado (`"private": true` em ' +
        '`package.json`) — sem licença de reuso público a declarar aqui.',
    },
    servers: [{ description: 'Servidor atual (relativo)', url: '/' }],
    tags: [
      { name: 'Auth', description: 'Cadastro e sessão (login/logout via Auth.js v5).' },
      { name: 'Categories', description: 'Catálogo de categorias.' },
      { name: 'Occurrences', description: 'Ciclo de vida de uma ocorrência.' },
      { name: 'Uploads', description: 'Upload e leitura de imagens.' },
      { name: 'Dashboard', description: 'Indicadores gerenciais (restrito a GESTOR).' },
      { name: 'Health', description: 'Health check público.' },
    ],
  });
}
