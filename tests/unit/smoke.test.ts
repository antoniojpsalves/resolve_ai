import { describe, expect, it } from 'vitest';

import { AppError, isAppError } from '@/core/errors';

describe('AppError (smoke test)', () => {
  it('carrega code, message e status corretamente', () => {
    const error = new AppError('OCCURRENCE_NOT_FOUND', 'Ocorrência não encontrada', 404);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.code).toBe('OCCURRENCE_NOT_FOUND');
    expect(error.message).toBe('Ocorrência não encontrada');
    expect(error.status).toBe(404);
  });

  it('usa 400 como status padrão quando não informado', () => {
    const error = new AppError('VALIDATION_ERROR', 'Dados inválidos');

    expect(error.status).toBe(400);
  });

  it('isAppError diferencia AppError de um Error genérico', () => {
    expect(isAppError(new AppError('X', 'x'))).toBe(true);
    expect(isAppError(new Error('erro genérico'))).toBe(false);
    expect(isAppError('não é um erro')).toBe(false);
  });
});
