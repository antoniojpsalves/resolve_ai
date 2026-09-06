/**
 * Fuso fixo em vez do fuso do servidor: o produto é nacional (Brasil) e datas
 * de ocorrência não devem mudar de dia dependendo de onde o processo Node
 * está rodando (dev local vs. container Docker com `TZ` diferente).
 */
const TIME_ZONE = 'America/Sao_Paulo';

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** Formata só a data, no padrão `dd/mm/aaaa`. */
export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: TIME_ZONE }).format(
    toDate(value),
  );
}

/** Formata data e hora, no padrão `dd/mm/aaaa, hh:mm` (vírgula do `Intl.DateTimeFormat`). */
export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(toDate(value));
}
