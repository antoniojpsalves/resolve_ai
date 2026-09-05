import type { FileStorage } from '@/modules/occurrence/application/ports/file-storage';

import { blobFileStorage } from './blob-file-storage';
import { localFileStorage } from './local-file-storage';

/**
 * Escolhe o adaptador de `FileStorage` conforme o ambiente: quando
 * `BLOB_READ_WRITE_TOKEN` está definido — a Vercel injeta essa variável
 * automaticamente quando um Blob store está conectado ao projeto — usa
 * `blobFileStorage`; caso contrário (desenvolvimento local e Docker Compose,
 * onde a variável não existe), usa `localFileStorage`, que grava em
 * `.storage/uploads/`.
 *
 * As rotas (`src/app/api/v1/uploads/**`) importam só este módulo — nunca os
 * dois adaptadores diretamente — para não decidir o ambiente em dois
 * lugares.
 */
export const fileStorage: FileStorage = process.env.BLOB_READ_WRITE_TOKEN
  ? blobFileStorage
  : localFileStorage;
