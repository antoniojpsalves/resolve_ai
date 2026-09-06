import type { FileStorage, StoredFile } from '@/modules/occurrence/application/ports/file-storage';

/**
 * Fake em memória de `FileStorage`, usado pelo teste de `upload-image` para
 * confirmar o que o use-case manda salvar (contentType e extension
 * derivados do formato detectado) sem tocar disco nem o Vercel Blob.
 */
export function createInMemoryFileStorage() {
  const saved: Array<{ data: Uint8Array; contentType: string; extension: string }> = [];
  const knownKeys = new Set<string>();
  let nextId = 1;

  const storage: FileStorage = {
    async save(input): Promise<StoredFile> {
      saved.push(input);
      const key = `fake-${nextId++}.${input.extension}`;
      knownKeys.add(key);

      return { url: `/api/v1/uploads/${key}`, key };
    },

    // Mesma regra dos adaptadores reais: a URL é derivada da chave no momento
    // da leitura, nunca lida de um valor gravado. `null` para chave que este
    // fake nunca salvou — o suficiente para os testes que verificam a
    // chamada de `urlForKey` sem depender de disco nem de rede.
    async urlForKey(key: string): Promise<string | null> {
      return knownKeys.has(key) ? `/api/v1/uploads/${key}` : null;
    },
  };

  return { storage, saved };
}
