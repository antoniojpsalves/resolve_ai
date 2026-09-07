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

  /**
   * Deriva a URL de leitura de uma chave já persistida (`Occurrence.imageKey`).
   * Sempre recalculada no momento da leitura pelo adaptador ativo no
   * ambiente atual — nunca lida de uma URL gravada no banco. Isso é o que
   * garante que uma chave criada em desenvolvimento (servida por
   * `GET /api/v1/uploads/<key>`) nunca vira uma URL morta se a linha for
   * parar num banco onde o adaptador ativo é o Blob, e vice-versa: o valor
   * devolvido depende só de quem está lendo agora, nunca de quem gravou a
   * linha.
   *
   * `null` quando a chave não corresponde a nenhum arquivo existente no
   * storage ativo.
   */
  urlForKey(key: string): Promise<string | null>;
}
