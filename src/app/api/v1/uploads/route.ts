import { ValidationError } from '@/core/errors';
import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import { uploadImage } from '@/modules/occurrence/application/upload-image';
import { fileStorage } from '@/modules/occurrence/infra/file-storage';

/**
 * `POST /api/v1/uploads` — recebe `multipart/form-data` com um campo de
 * arquivo chamado `file` e devolve `201 { url, key }`.
 *
 * Handler só transporte: extrai os bytes do `FormData` e delega ao
 * use-case (`uploadImage`), que valida vazio/tamanho/formato pelos magic
 * bytes do conteúdo — o `Content-Type` do `File` do multipart (controlado
 * por quem chama) nunca chega ao use-case.
 *
 * Sem sessão → 401 (`requireSession`). Sem arquivo ou corpo que não é
 * multipart válido → 422. Tipo não permitido → 422 (`ValidationError` do
 * use-case). Maior que 5 MB → 413 (`PayloadTooLargeError` do use-case).
 */
export const POST = route(async (request: Request) => {
  await requireSession();

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');

  if (!file || !(file instanceof File)) {
    throw new ValidationError('Arquivo obrigatório', {
      detail: 'Envie o arquivo no campo "file" de um multipart/form-data.',
    });
  }

  const data = new Uint8Array(await file.arrayBuffer());

  const result = await uploadImage({ data }, { storage: fileStorage });

  return Response.json(result, { status: 201 });
});
