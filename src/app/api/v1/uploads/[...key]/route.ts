import { NotFoundError } from '@/core/errors';
import { route } from '@/core/http/handler';
import { requireSession } from '@/core/http/auth-guards';
import { mimeTypeForExtension } from '@/modules/occurrence/domain/image-format';
import { isValidUploadKey } from '@/modules/occurrence/domain/upload-key';
import { readLocalFile } from '@/modules/occurrence/infra/local-file-storage';

type RouteContext = { params: Promise<{ key: string[] }> };

/**
 * `GET /api/v1/uploads/[...key]` — serve um arquivo do storage local
 * (desenvolvimento/Docker; em produção o Vercel Blob serve direto pela URL
 * pública que ele mesmo devolve, sem passar por esta rota).
 *
 * Handler só transporte: fala com `infra/local-file-storage.ts` só através
 * de `readLocalFile` — nunca importa `node:fs`/`node:path` nem sabe onde o
 * arquivo mora em disco. É o mesmo princípio de `POST /uploads`, que só
 * conhece a port `FileStorage`.
 *
 * Exige sessão (`requireSession`), igual a `GET /api/v1/categories` — decisão
 * do dono do produto: qualquer usuário autenticado vê qualquer imagem, sem
 * escopo por papel e sem checar se o usuário pode ver a ocorrência dona da
 * imagem (isso foi considerado e deliberadamente não escolhido, por custo e
 * por divergir demais do adaptador de produção). Sem sessão → 401.
 *
 * **Divergência conhecida com produção:** `blob-file-storage.ts` grava com
 * `access: 'public'` — a URL do Vercel Blob não passa por sessão nenhuma.
 * Ver o comentário lá para o registro completo dessa pendência.
 *
 * A chave vem da URL — entrada de quem chama, nunca confiável. Os
 * segmentos do catch-all são unidos com `/` e validados contra
 * `isValidUploadKey` **antes** de chamar `readLocalFile`: o padrão estrito
 * (`^[a-f0-9-]+\.(jpg|jpeg|png|webp)$`) não aceita `/` nem `.` fora da
 * extensão, então qualquer `../../.env` — cru ou com `%2e`/`%2f`
 * codificados — falha aqui, antes de qualquer acesso a disco. Nunca
 * concatenamos o segmento bruto num caminho de arquivo. Essa validação
 * acontece **depois** de `requireSession`, mas o comportamento é o mesmo com
 * ou sem sessão válida — a ordem só decide qual 401/404 chega primeiro
 * quando as duas condições falham juntas, nunca abre uma exceção para a
 * validação de chave.
 *
 * Chave inválida e arquivo inexistente devolvem o mesmo 404 — não é
 * relevante para quem chama, e evita confirmar por timing/mensagem se uma
 * chave "quase válida" aponta para algo que existe no disco.
 */
export const GET = route(async (_request: Request, { params }: RouteContext) => {
  await requireSession();

  const { key: segments } = await params;
  const key = segments.join('/');

  if (!isValidUploadKey(key)) {
    throw new NotFoundError('Arquivo não encontrado');
  }

  const data = await readLocalFile(key);

  if (!data) {
    throw new NotFoundError('Arquivo não encontrado');
  }

  const extension = key.slice(key.lastIndexOf('.') + 1);

  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': mimeTypeForExtension(extension) },
  });
});
