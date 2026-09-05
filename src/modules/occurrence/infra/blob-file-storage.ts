import { randomUUID } from 'node:crypto';

import { put } from '@vercel/blob';

import type { FileStorage, StoredFile } from '@/modules/occurrence/application/ports/file-storage';

/**
 * Implementação de `FileStorage` sobre o Vercel Blob — usada em produção,
 * onde não há disco persistente entre invocações da função serverless.
 * Selecionada por `file-storage.ts` só quando `BLOB_READ_WRITE_TOKEN` está
 * definido (o SDK lê essa variável de ambiente sozinho; não é passada aqui
 * explicitamente).
 *
 * Não verificado contra o Blob real ainda — não há como configurar a
 * Vercel neste ambiente. Fica verificado de
 * verdade quando o deploy acontecer.
 *
 * A chave é gerada aqui, sempre `<uuid>.<extension>`, no mesmo formato da
 * implementação local — nunca a partir de um nome de arquivo do cliente.
 */
export const blobFileStorage: FileStorage = {
  async save({ data, contentType, extension }): Promise<StoredFile> {
    const key = `${randomUUID()}.${extension}`;

    const blob = await put(key, Buffer.from(data), {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    });

    return { url: blob.url, key };
  },
};
