/**
 * Validação da chave de upload recebida em `GET /api/v1/uploads/[...key]`.
 *
 * A chave vem da URL — entrada de quem chama, não confiável. Um padrão
 * estrito que só aceita `<hex>.<extensão permitida>` (o formato que o
 * próprio servidor gera ao salvar, ver `infra/local-file-storage.ts`) barra
 * qualquer tentativa de path traversal por construção: a ausência de `/` e
 * de `.` fora da extensão no conjunto de caracteres aceito já rejeita
 * `../../.env`, `..%2f..%2f.env` (decodificado ou não — `%` não faz parte do
 * conjunto aceito) e qualquer variante equivalente, sem precisar de uma
 * lista de bloqueio. Nunca concatene o input direto num caminho de arquivo
 * sem passar por aqui antes.
 */
const UPLOAD_KEY_PATTERN = /^[a-f0-9-]+\.(jpg|jpeg|png|webp)$/;

export function isValidUploadKey(key: string): boolean {
  return UPLOAD_KEY_PATTERN.test(key);
}
