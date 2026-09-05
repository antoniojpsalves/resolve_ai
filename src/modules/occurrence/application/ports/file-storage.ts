/** Resultado de um `save`: URL pública de acesso e a chave que a identifica no storage. */
export type StoredFile = { url: string; key: string };

/**
 * Port de armazenamento de arquivo. `upload-image.ts` depende só disto —
 * nunca sabe se o arquivo foi para disco (`infra/local-file-storage.ts`) ou
 * para o Vercel Blob (`infra/blob-file-storage.ts`).
 *
 * A implementação é quem gera a chave (ex.: `<uuid>.<extension>`) — nunca a
 * partir de um nome vindo do cliente, que é vetor de path traversal.
 * `extension` já vem derivada do formato **detectado** pelo use-case
 * (`domain/image-format.ts`), nunca do nome de arquivo enviado.
 */
export interface FileStorage {
  save(input: { data: Uint8Array; contentType: string; extension: string }): Promise<StoredFile>;
}
