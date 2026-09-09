import { z } from 'zod';

import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

/**
 * Efeito colateral: acrescenta o método `.openapi(...)` ao protótipo de
 * `ZodType` (biblioteca `@asteasolutions/zod-to-openapi`). Precisa rodar
 * **antes** de qualquer `.openapi(...)` ser chamado neste módulo.
 *
 * Importante: `.openapi(...)` devolve um **clone** do schema com metadados
 * anexados (`new this.constructor({ ...this._def, openapi: ... })`) — não
 * modifica o schema original. Por isso este módulo nunca precisa tocar nos
 * schemas Zod que já existem em `application/` (`createOccurrenceSchema`,
 * `registerUserSchema`, ...): eles são só importados e envolvidos aqui, o
 * comportamento de validação em runtime desses schemas originais continua
 * intacto.
 *
 * Este import só existe para o efeito colateral — nenhum símbolo é exportado
 * daqui. Todo módulo deste diretório que use `.openapi(...)` deve importar
 * `./zod-extend` primeiro (basta `import './zod-extend'` no topo).
 */
extendZodWithOpenApi(z);
