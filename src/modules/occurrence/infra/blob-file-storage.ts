import { randomUUID } from 'node:crypto';

import { BlobNotFoundError, head, put } from '@vercel/blob';

import type { FileStorage, StoredFile } from '@/modules/occurrence/application/ports/file-storage';

/**
 * Implementação de `FileStorage` sobre o Vercel Blob — usada em produção,
 * onde não há disco persistente entre invocações da função serverless.
 * Selecionada por `file-storage.ts` só quando `BLOB_READ_WRITE_TOKEN` está
 * definido (o SDK lê essa variável de ambiente sozinho; não é passada aqui
 * explicitamente).
 *
 * Não verificado contra o Blob real nesta implementação — não há como
 * configurar um store da Vercel neste ambiente. Fica verificado de verdade
 * quando o deploy em produção acontecer.
 *
 * A chave é gerada aqui, sempre `<uuid>.<extension>`, no mesmo formato da
 * implementação local — nunca a partir de um nome de arquivo do cliente.
 *
 * **Pendência conhecida — divergência com o comportamento de desenvolvimento:**
 * `access: 'public'` significa que a URL devolvida pelo Blob é pública e não
 * passa por sessão nenhuma — qualquer pessoa com a URL acessa a imagem, sem
 * login. Isso diverge de `GET /api/v1/uploads/[...key]` (o adaptador local),
 * que exige sessão (`requireSession`). Para o comportamento de produção bater
 * com o de desenvolvimento, uma implantação futura precisa escolher uma das
 * duas: (a) trocar `access: 'public'` por uma URL assinada/privada do Blob,
 * ou (b) parar de expor a URL pública do Blob direto no `imageUrl` e servir o
 * conteúdo através de uma rota própria autenticada (o mesmo papel que
 * `GET /api/v1/uploads/[...key]` cumpre para o storage local). Nenhuma das
 * duas foi implementada aqui — decisão pendente, registrada só para não
 * esquecer antes do primeiro deploy real.
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

  // `head(key)` é a API pública do SDK para resolver metadados (incluindo a
  // URL) a partir só do "pathname" — não existe função exportada para montar
  // a URL manualmente a partir da chave, e reconstruir o formato por conta
  // própria (fazendo parsing de `BLOB_READ_WRITE_TOKEN`) dependeria de um
  // detalhe interno do SDK que não faz parte do contrato público dele. O
  // custo é uma chamada de rede por leitura — aceitável aqui porque só a
  // tela de detalhe de uma ocorrência (uma leitura por vez) consome isto,
  // nunca a listagem.
  async urlForKey(key: string): Promise<string | null> {
    try {
      const result = await head(key);

      return result.url;
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return null;
      }

      throw error;
    }
  },
};
