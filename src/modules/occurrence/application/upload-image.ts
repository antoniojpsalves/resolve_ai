import { PayloadTooLargeError, ValidationError } from '@/core/errors';

import {
  detectImageFormat,
  extensionForImageFormat,
  mimeTypeForImageFormat,
} from '../domain/image-format';

import type { FileStorage, StoredFile } from './ports/file-storage';

/** Limite de tamanho de upload (item 2 do brief): 5 MB. */
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export interface UploadImageInput {
  /** Conteúdo bruto do arquivo enviado. O `Content-Type` do cliente é ignorado de propósito. */
  data: Uint8Array;
}

export interface UploadImageDeps {
  storage: FileStorage;
}

/**
 * Valida e grava a imagem enviada, devolvendo `{ url, key }`.
 *
 * Deliberadamente **não recebe** o `Content-Type` enviado pelo cliente: esse
 * cabeçalho é controlado por quem chama e não prova nada sobre o conteúdo
 * real do arquivo — um `.php` renomeado para `.png` chega aqui com
 * `Content-Type: image/png` do mesmo jeito. A única fonte de verdade sobre o
 * formato é `detectImageFormat`, que lê os magic bytes do conteúdo.
 *
 * Ordem das validações: vazio → tamanho → formato. Vazio e tamanho são
 * checagens baratas sobre `byteLength`; só chega a olhar os bytes quando o
 * arquivo tem um tamanho plausível.
 */
export async function uploadImage(
  input: UploadImageInput,
  { storage }: UploadImageDeps,
): Promise<StoredFile> {
  if (input.data.byteLength === 0) {
    throw new ValidationError('Arquivo vazio', {
      detail: 'Envie um arquivo de imagem — o arquivo recebido está vazio.',
    });
  }

  if (input.data.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new PayloadTooLargeError('Arquivo muito grande', {
      detail: `O arquivo excede o limite de ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB.`,
    });
  }

  const format = detectImageFormat(input.data);

  if (!format) {
    throw new ValidationError('Tipo de arquivo não permitido', {
      detail:
        'Apenas imagens JPEG, PNG ou WebP são aceitas. O conteúdo do arquivo enviado não ' +
        'corresponde a nenhum desses formatos — o Content-Type declarado não é considerado.',
    });
  }

  return storage.save({
    data: input.data,
    contentType: mimeTypeForImageFormat(format),
    extension: extensionForImageFormat(format),
  });
}
