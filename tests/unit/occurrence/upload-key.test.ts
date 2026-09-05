import { describe, expect, it } from 'vitest';

import { isValidUploadKey } from '@/modules/occurrence/domain/upload-key';

describe('isValidUploadKey', () => {
  it.each([
    'f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479.jpeg',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479.png',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479.webp',
  ])('aceita %s (chave gerada pelo próprio servidor)', (key) => {
    expect(isValidUploadKey(key)).toBe(true);
  });

  it.each([
    ['path traversal cru', '../../.env'],
    ['path traversal codificado', '..%2f..%2f.env'],
    ['path traversal decodificado', '..%2e%2e%2f.env'],
    ['barra simples', '/etc/passwd'],
    ['sem extensão', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'],
    ['extensão não permitida', 'f47ac10b-58cc-4372-a567-0e02b2c3d479.php'],
    ['extensão dupla', 'f47ac10b-58cc-4372-a567-0e02b2c3d479.png.php'],
    ['maiúsculas fora do conjunto hex', 'F47AC10B.jpg'],
    ['string vazia', ''],
    ['apenas a extensão', '.png'],
    ['espaço embutido', 'abc def.png'],
    ['ponto extra no meio', 'abc.def.png'],
  ])('rejeita %s: %s', (_label, key) => {
    expect(isValidUploadKey(key)).toBe(false);
  });
});
