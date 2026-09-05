import { route } from '@/core/http/handler';
import { registerUser, registerUserSchema } from '@/modules/identity/application/register-user';
import { hashPassword } from '@/modules/identity/infra/password';
import { prismaUserRepository } from '@/modules/identity/infra/prisma-user-repository';

/**
 * `POST /api/v1/auth/register` — cadastro público.
 *
 * O handler é só transporte: parseia o corpo, delega ao use-case e serializa a
 * resposta. Erros (`ZodError`, `ConflictError`) sobem e viram problem+json no
 * wrapper `route`.
 */
export const POST = route(async (request: Request) => {
  const body: unknown = await request.json().catch(() => null);
  const input = registerUserSchema.parse(body);

  const user = await registerUser(input, {
    users: prismaUserRepository,
    hashPassword,
  });

  return Response.json(user, { status: 201 });
});
