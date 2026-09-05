import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FileStorage, StoredFile } from '@/modules/occurrence/application/ports/file-storage';

/**
 * Implementação local de `FileStorage`: grava em `.storage/uploads/` na raiz
 * do projeto (fora de `src/` e de `public/` — não é servido estaticamente
 * pelo Next; quem serve é a rota `GET /api/v1/uploads/[...key]`) e devolve
 * uma URL relativa que essa mesma rota resolve. Usada em desenvolvimento e
 * no Docker Compose local — nunca em produção, onde `file-storage.ts`
 * seleciona `blob-file-storage.ts` no lugar.
 *
 * A chave é gerada aqui, sempre `<uuid>.<extension>` — nunca a partir de um
 * nome de arquivo do cliente (que não chega até esta camada; o use-case só
 * repassa os bytes e a extensão já derivada do formato detectado).
 */
export const UPLOAD_DIR = path.join(process.cwd(), '.storage', 'uploads');

export const localFileStorage: FileStorage = {
  async save({ data, extension }): Promise<StoredFile> {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const key = `${randomUUID()}.${extension}`;
    await writeFile(path.join(UPLOAD_DIR, key), data);

    return { url: `/api/v1/uploads/${key}`, key };
  },
};
