'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

/**
 * Espelha `registerUserSchema` do use-case e acrescenta a confirmação de senha,
 * que é uma exigência de UI e não de domínio. A validação do servidor continua
 * sendo a autoridade — esta aqui só evita um round-trip.
 */
const registerSchema = z
  .object({
    name: z.string().trim().min(3, 'O nome precisa ter ao menos 3 caracteres'),
    email: z.string().trim().min(1, 'Informe seu e-mail').email('Informe um e-mail válido'),
    password: z
      .string()
      .min(8, 'A senha precisa ter ao menos 8 caracteres')
      .regex(/^(?=.*[A-Za-zÀ-ÿ])(?=.*\d).+$/, 'A senha precisa ter ao menos uma letra e um número'),
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  });

type RegisterValues = z.infer<typeof registerSchema>;

interface ProblemBody {
  title?: string;
  detail?: string;
}

const AFTER_REGISTER_URL = '/ocorrencias';

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: RegisterValues) {
    setFormError(null);

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
        }),
      });

      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as ProblemBody | null;

        setFormError(
          problem?.detail ?? problem?.title ?? 'Não foi possível criar sua conta. Tente novamente.',
        );
        return;
      }

      // Login automático logo após o cadastro.
      const signInResult = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl: AFTER_REGISTER_URL,
      });

      if (!signInResult || signInResult.error) {
        // A conta existe; só a sessão falhou. Manda para o login em vez de travar.
        router.replace('/login');
        return;
      }

      router.replace(AFTER_REGISTER_URL);
      router.refresh();
    } catch {
      setFormError('Não foi possível criar sua conta. Tente novamente.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Criar conta</CardTitle>
        <CardDescription>Leva menos de um minuto.</CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            {formError ? (
              <p
                role="alert"
                className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
              >
                {formError}
              </p>
            ) : null}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" placeholder="Seu nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="voce@exemplo.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar senha</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="mt-6 flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {isSubmitting ? 'Criando conta…' : 'Criar conta'}
            </Button>

            <p className="text-muted-foreground text-sm">
              Já tem conta?{' '}
              <Link
                href="/login"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                Entrar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
