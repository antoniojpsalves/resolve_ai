/**
 * Constrói o código de protocolo de uma ocorrência no formato `OC-2026-000123`
 * (ano com 4 dígitos, sequência com 6 dígitos, zero-padded).
 *
 * Função pura — a obtenção do número sequencial a partir do banco é
 * responsabilidade de outra camada (Dia 2). Aqui só formatação.
 */
export function buildOccurrenceCode(year: number, sequence: number): string {
  const yearPart = String(year).padStart(4, '0');
  const sequencePart = String(sequence).padStart(6, '0');

  return `OC-${yearPart}-${sequencePart}`;
}
