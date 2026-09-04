import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '@/core/errors';
import { route } from '@/core/http/handler';
import { PROBLEM_CONTENT_TYPE } from '@/core/http/problem';

describe('route()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devolve a resposta do handler quando não há erro', async () => {
    const handler = route(async (value: string) => Response.json({ value }, { status: 201 }));

    const response = await handler('ok');

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ value: 'ok' });
  });

  it('converte a exceção do handler em problem+json', async () => {
    const handler = route(async () => {
      throw new NotFoundError('Ocorrência não encontrada');
    });

    const response = await handler();

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe(PROBLEM_CONTENT_TYPE);
    await expect(response.json()).resolves.toMatchObject({
      type: 'https://resolveai.app/errors/not-found',
      title: 'Ocorrência não encontrada',
      status: 404,
    });
  });

  it('converte exceções síncronas também', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = route(() => {
      throw new Error('boom');
    });

    const response = await handler();

    expect(response.status).toBe(500);
  });
});
