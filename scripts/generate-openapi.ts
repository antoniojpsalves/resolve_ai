/**
 * Gera `openapi.json` (raiz do repositório) a partir do registro Zod →
 * OpenAPI (`src/core/openapi/`) — artefato estático para ferramentas
 * externas (colar em `https://editor.swagger.io`, `npx @redocly/cli lint
 * openapi.json`, anexar a um relatório).
 *
 * A rota `/api/docs` **não lê este arquivo**: ela chama
 * `generateOpenApiDocument()` diretamente em runtime (mesma função que este
 * script chama), então a UI nunca fica desatualizada mesmo que alguém
 * esqueça de rodar este script. Ver o comentário de decisão em
 * `src/core/openapi/document.ts`.
 *
 * Reexecute (`npx tsx scripts/generate-openapi.ts`) sempre que um schema Zod
 * usado no contrato (`application/*Schema`) mudar, para o arquivo estático
 * não divergir do código.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateOpenApiDocument } from '@/core/openapi/document';

function main(): void {
  const document = generateOpenApiDocument();
  const outputPath = join(process.cwd(), 'openapi.json');

  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');

  console.log(`openapi.json gerado em ${outputPath}`);
  console.log(
    `  paths: ${Object.keys(document.paths ?? {}).length}, ` +
      `schemas: ${Object.keys(document.components?.schemas ?? {}).length}`,
  );
}

main();
