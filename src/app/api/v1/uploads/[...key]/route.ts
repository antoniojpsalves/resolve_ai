import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NotFoundError } from '@/core/errors';
import { route } from '@/core/http/handler';
import { mimeTypeForExtension } from '@/modules/occurrence/domain/image-format';
import { isValidUploadKey } from '@/modules/occurrence/domain/upload-key';
import { UPLOAD_DIR } from '@/modules/occurrence/infra/local-file-storage';

type RouteContext = { params: Promise<{ key: string[] }> };

/**
 * `GET /api/v1/uploads/[...key]` — serve um arquivo do storage local
 * (desenvolvimento/Docker; em produção o Vercel Blob serve direto pela URL
 * pública que ele mesmo devolve, sem passar por esta rota).
 *
 * A chave vem da URL — entrada de quem chama, nunca confiável. Os
 * segmentos do catch-all são unidos com `/` e validados contra
 * `isValidUploadKey` **antes** de tocar o sistema de arquivos: o padrão
 * estrito (`^[a-f0-9-]+\.(jpg|jpeg|png|webp)$`) não aceita `/` nem `.` fora
 * da extensão, então qualquer `../../.env` — cru ou com `%2e`/`%2f`
 * codificados — falha aqui, antes de qualquer `path.join`. Nunca
 * concatenamos o segmento bruto num caminho de arquivo.
 *
 * Chave inválida e arquivo inexistente devolvem o mesmo 404 — não é
 * relevante para quem chama, e evita confirmar por timing/mensagem se uma
 * chave "quase válida" aponta para algo que existe no disco.
 */
export const GET = route(async (_request: Request, { params }: RouteContext) => {
  const { key: segments } = await params;
  const key = segments.join('/');

  if (!isValidUploadKey(key)) {
    throw new NotFoundError('Arquivo não encontrado');
  }

  const filePath = path.join(UPLOAD_DIR, key);

  const data = await readFile(filePath).catch(() => null);

  if (!data) {
    throw new NotFoundError('Arquivo não encontrado');
  }

  const extension = key.slice(key.lastIndexOf('.') + 1);

  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': mimeTypeForExtension(extension) },
  });
});
