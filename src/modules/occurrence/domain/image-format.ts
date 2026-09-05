/**
 * Detecção de formato de imagem pelos *magic bytes* do conteúdo real — nunca
 * pelo `Content-Type` declarado por quem envia (esse cabeçalho é controlado
 * pelo cliente e não prova nada sobre o conteúdo). Lógica pura, sem I/O: só
 * lê os primeiros bytes do buffer e compara com a assinatura de cada
 * formato aceito.
 *
 * Assinaturas:
 *  - JPEG: `FF D8 FF` nos 3 primeiros bytes;
 *  - PNG:  `89 50 4E 47 0D 0A 1A 0A` nos 8 primeiros bytes;
 *  - WebP: `RIFF` (`52 49 46 46`) nos bytes 0-3 e `WEBP` (`57 45 42 50`) nos
 *    bytes 8-11 (o contêiner RIFF genérico entre os dois trechos guarda o
 *    tamanho do payload, irrelevante para a detecção de formato).
 */
export type ImageFormat = 'jpeg' | 'png' | 'webp';

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];

function matchesSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Devolve o formato detectado a partir do conteúdo, ou `null` quando o
 * conteúdo é vazio, truncado (menor que a assinatura de qualquer formato
 * aceito) ou não corresponde a nenhum dos três formatos aceitos — inclusive
 * quando o `Content-Type` declarado afirmar o contrário.
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (matchesSignature(bytes, JPEG_SIGNATURE)) {
    return 'jpeg';
  }

  if (matchesSignature(bytes, PNG_SIGNATURE)) {
    return 'png';
  }

  if (matchesSignature(bytes, RIFF_SIGNATURE, 0) && matchesSignature(bytes, WEBP_SIGNATURE, 8)) {
    return 'webp';
  }

  return null;
}

/** Extensão de arquivo a gravar para um formato detectado — nunca o nome enviado pelo cliente. */
export function extensionForImageFormat(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

/** MIME type canônico de um formato detectado, para devolver como `Content-Type` real. */
export function mimeTypeForImageFormat(format: ImageFormat): string {
  return `image/${format}`;
}

/** Mapa inverso: extensão de arquivo → `Content-Type`, usado ao servir o arquivo salvo. */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * `Content-Type` a devolver para uma extensão de arquivo já validada (por
 * `isValidUploadKey`). Devolve `application/octet-stream` para qualquer
 * extensão fora do mapa — não deveria acontecer na prática, já que a chave
 * só chega aqui depois de passar pelo padrão estrito, mas evita lançar em
 * vez de simplesmente servir um `Content-Type` genérico.
 */
export function mimeTypeForExtension(extension: string): string {
  return MIME_BY_EXTENSION[extension.toLowerCase()] ?? 'application/octet-stream';
}
