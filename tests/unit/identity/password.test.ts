import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '@/modules/identity/infra/password';

describe('password (hashPassword/verifyPassword)', () => {
  it('gera um hash diferente da senha em texto plano e verifica corretamente', async () => {
    const plain = 'Senha@123';

    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(await verifyPassword(plain, hash)).toBe(true);
  });

  it('retorna false ao verificar com a senha errada', async () => {
    const hash = await hashPassword('Senha@123');

    expect(await verifyPassword('SenhaErrada@123', hash)).toBe(false);
  });
});
