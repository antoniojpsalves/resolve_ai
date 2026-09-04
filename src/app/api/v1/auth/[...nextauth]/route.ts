import { handlers } from '@/auth';

/**
 * Endpoints do Auth.js sob `/api/v1/auth/*` (signin, signout, session, csrf...).
 * A rota específica `/api/v1/auth/register` tem precedência sobre este
 * catch-all no roteamento do Next.js.
 */
export const { GET, POST } = handlers;
