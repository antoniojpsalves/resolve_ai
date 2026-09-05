import type { FileStorage, StoredFile } from '@/modules/occurrence/application/ports/file-storage';

/**
 * Fake em memória de `FileStorage`, usado pelo teste de `upload-image` para
 * confirmar o que o use-case manda salvar (contentType e extension
 * derivados do formato detectado) sem tocar disco nem o Vercel Blob.
 */
export function createInMemoryFileStorage() {
  const saved: Array<{ data: Uint8Array; contentType: string; extension: string }> = [];
  let nextId = 1;

  const storage: FileStorage = {
    async save(input): Promise<StoredFile> {
      saved.push(input);
      const key = `fake-${nextId++}.${input.extension}`;

      return { url: `/api/v1/uploads/${key}`, key };
    },
  };

  return { storage, saved };
}
