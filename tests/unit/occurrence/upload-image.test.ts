import { describe, expect, it } from 'vitest';

import { PayloadTooLargeError, ValidationError } from '@/core/errors';
import { MAX_UPLOAD_SIZE_BYTES, uploadImage } from '@/modules/occurrence/application/upload-image';

import { createInMemoryFileStorage } from '../../helpers/file-storage';

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50,
]);

describe('uploadImage', () => {
  it('grava um PNG válido e devolve { url, key } do storage', async () => {
    const { storage, saved } = createInMemoryFileStorage();

    const result = await uploadImage({ data: PNG_BYTES }, { storage });

    expect(result.key).toMatch(/\.png$/);
    expect(result.url).toBe(`/api/v1/uploads/${result.key}`);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.contentType).toBe('image/png');
    expect(saved[0]!.extension).toBe('png');
  });

  it('grava um JPEG válido com extensão jpg derivada do formato detectado', async () => {
    const { storage, saved } = createInMemoryFileStorage();

    await uploadImage({ data: JPEG_BYTES }, { storage });

    expect(saved[0]!.contentType).toBe('image/jpeg');
    expect(saved[0]!.extension).toBe('jpg');
  });

  it('grava um WebP válido', async () => {
    const { storage, saved } = createInMemoryFileStorage();

    await uploadImage({ data: WEBP_BYTES }, { storage });

    expect(saved[0]!.contentType).toBe('image/webp');
    expect(saved[0]!.extension).toBe('webp');
  });

  it('rejeita arquivo vazio com ValidationError, sem chamar o storage', async () => {
    const { storage, saved } = createInMemoryFileStorage();

    await expect(uploadImage({ data: new Uint8Array() }, { storage })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(saved).toHaveLength(0);
  });

  it('rejeita arquivo maior que 5 MB com PayloadTooLargeError, sem chamar o storage', async () => {
    const { storage, saved } = createInMemoryFileStorage();
    const oversized = new Uint8Array(MAX_UPLOAD_SIZE_BYTES + 1);
    oversized.set(PNG_BYTES); // conteúdo válido no início, só o tamanho é que estoura

    await expect(uploadImage({ data: oversized }, { storage })).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
    expect(saved).toHaveLength(0);
  });

  it('aceita um arquivo exatamente no limite de 5 MB', async () => {
    const { storage, saved } = createInMemoryFileStorage();
    const atLimit = new Uint8Array(MAX_UPLOAD_SIZE_BYTES);
    atLimit.set(PNG_BYTES);

    await uploadImage({ data: atLimit }, { storage });

    expect(saved).toHaveLength(1);
  });

  it('rejeita conteúdo que não bate com nenhum formato aceito — não confia no Content-Type do cliente', async () => {
    // Simula o caso central do brief: um .php renomeado para .png, enviado
    // com Content-Type: image/png. O use-case nem recebe o Content-Type do
    // cliente como entrada — só teria como "confiar" nele se o aceitasse
    // como parâmetro, o que a assinatura de uploadImage não permite. Aqui
    // testamos que o conteúdo real (texto puro) é rejeitado por si só.
    const { storage, saved } = createInMemoryFileStorage();
    const maliciousPhpRenamedAsPng = new TextEncoder().encode('<?php system($_GET["cmd"]); ?>');

    await expect(
      uploadImage({ data: maliciousPhpRenamedAsPng }, { storage }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(saved).toHaveLength(0);
  });

  it('rejeita arquivo truncado (menor que qualquer assinatura válida)', async () => {
    const { storage, saved } = createInMemoryFileStorage();

    await expect(
      uploadImage({ data: new Uint8Array([0xff, 0xd8]) }, { storage }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(saved).toHaveLength(0);
  });
});
