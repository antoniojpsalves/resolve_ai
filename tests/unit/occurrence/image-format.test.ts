import { describe, expect, it } from 'vitest';

import {
  detectImageFormat,
  extensionForImageFormat,
  mimeTypeForExtension,
  mimeTypeForImageFormat,
} from '@/modules/occurrence/domain/image-format';

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50,
]);

describe('detectImageFormat', () => {
  it('detecta JPEG pela assinatura FF D8 FF', () => {
    expect(detectImageFormat(JPEG_BYTES)).toBe('jpeg');
  });

  it('detecta PNG pela assinatura de 8 bytes', () => {
    expect(detectImageFormat(PNG_BYTES)).toBe('png');
  });

  it('detecta WebP por RIFF nos bytes 0-3 e WEBP nos bytes 8-11', () => {
    expect(detectImageFormat(WEBP_BYTES)).toBe('webp');
  });

  it('rejeita RIFF sem WEBP nos bytes 8-11 (outro contêiner RIFF, ex.: WAV)', () => {
    const riffWave = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);

    expect(detectImageFormat(riffWave)).toBeNull();
  });

  it('rejeita conteúdo de texto puro, mesmo que o nome/Content-Type minta sobre o formato', () => {
    // Este é o caso central: um .php ou .txt renomeado para .png,
    // enviado com Content-Type: image/png, tem que ser rejeitado — a
    // detecção olha só para o conteúdo real, nunca para metadados alheios.
    const fakePng = new TextEncoder().encode('<?php echo "não sou uma imagem"; ?>');

    expect(detectImageFormat(fakePng)).toBeNull();
  });

  it('rejeita arquivo vazio', () => {
    expect(detectImageFormat(new Uint8Array())).toBeNull();
  });

  it('rejeita arquivo truncado (menor que a assinatura de qualquer formato aceito)', () => {
    expect(detectImageFormat(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });

  it('rejeita JPEG truncado no meio da assinatura PNG', () => {
    expect(detectImageFormat(new Uint8Array([0x89, 0x50, 0x4e]))).toBeNull();
  });
});

describe('extensionForImageFormat', () => {
  it.each([
    ['jpeg', 'jpg'],
    ['png', 'png'],
    ['webp', 'webp'],
  ] as const)('mapeia %s para .%s', (format, extension) => {
    expect(extensionForImageFormat(format)).toBe(extension);
  });
});

describe('mimeTypeForImageFormat', () => {
  it.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ] as const)('mapeia %s para %s', (format, mime) => {
    expect(mimeTypeForImageFormat(format)).toBe(mime);
  });
});

describe('mimeTypeForExtension', () => {
  it.each([
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['JPG', 'image/jpeg'],
  ])('mapeia .%s para %s', (extension, mime) => {
    expect(mimeTypeForExtension(extension)).toBe(mime);
  });

  it('devolve application/octet-stream para extensão desconhecida', () => {
    expect(mimeTypeForExtension('exe')).toBe('application/octet-stream');
  });
});
