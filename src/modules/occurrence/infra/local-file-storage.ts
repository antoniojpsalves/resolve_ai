import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FileStorage, StoredFile } from '@/modules/occurrence/application/ports/file-storage';

/**
 * Implementação local de `FileStorage`: grava em `.storage/uploads/` na raiz
 * do projeto (fora de `src/` e de `public/` — não é servido estaticamente
 * pelo Next; quem serve é a rota `GET /api/v1/uploads/[...key]`, via
 * `readLocalFile` abaixo) e devolve uma URL relativa que essa mesma rota
 * resolve. Usada em desenvolvimento e no Docker Compose local — nunca em
 * produção, onde `file-storage.ts` seleciona `blob-file-storage.ts` no lugar.
 *
 * A chave é gerada aqui, sempre `<uuid>.<extension>` — nunca a partir de um
 * nome de arquivo do cliente (que não chega até esta camada; o use-case só
 * repassa os bytes e a extensão já derivada do formato detectado).
 *
 * `UPLOAD_DIR` não é exportado de propósito: este módulo é o único lugar que
 * sabe onde e como o storage local guarda arquivo em disco. Quem precisa
 * gravar usa `localFileStorage.save` (via a port `FileStorage`); quem precisa
 * ler usa `readLocalFile` — nunca `node:fs`/`node:path` direto de fora de
 * `infra/` (regra do projeto: cliente de storage só aparece aqui).
 */
const UPLOAD_DIR = path.join(process.cwd(), '.storage', 'uploads');

export const localFileStorage: FileStorage = {
  async save({ data, extension }): Promise<StoredFile> {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const key = `${randomUUID()}.${extension}`;
    await writeFile(path.join(UPLOAD_DIR, key), data);

    return { url: `/api/v1/uploads/${key}`, key };
  },
};

/**
 * Lê um arquivo gravado por `localFileStorage.save`, a partir da chave.
 * Devolve `null` quando o arquivo não existe (ex.: chave válida no formato,
 * mas apagada do disco) — quem chama decide o que fazer com isso (404,
 * tipicamente).
 *
 * **Não valida `key` contra path traversal** — isso é responsabilidade de
 * quem chama, com `isValidUploadKey` (`domain/upload-key.ts`), **antes** de
 * invocar esta função. `GET /api/v1/uploads/[...key]` é o único chamador
 * hoje e já faz essa checagem primeiro.
 */
export async function readLocalFile(key: string): Promise<Uint8Array | null> {
  try {
    const data = await readFile(path.join(UPLOAD_DIR, key));

    return new Uint8Array(data);
  } catch {
    return null;
  }
}
