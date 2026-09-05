import { describe, expect, it } from 'vitest';

import { blobFileStorage } from '@/modules/occurrence/infra/blob-file-storage';
import { selectFileStorage } from '@/modules/occurrence/infra/file-storage';
import { localFileStorage } from '@/modules/occurrence/infra/local-file-storage';

describe('selectFileStorage', () => {
  it('escolhe blobFileStorage quando BLOB_READ_WRITE_TOKEN está definido (produção na Vercel)', () => {
    expect(selectFileStorage({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_fake_token' })).toBe(
      blobFileStorage,
    );
  });

  it('escolhe localFileStorage quando BLOB_READ_WRITE_TOKEN está ausente (dev/Docker)', () => {
    expect(selectFileStorage({})).toBe(localFileStorage);
  });

  it('escolhe localFileStorage quando BLOB_READ_WRITE_TOKEN é string vazia', () => {
    expect(selectFileStorage({ BLOB_READ_WRITE_TOKEN: '' })).toBe(localFileStorage);
  });
});
