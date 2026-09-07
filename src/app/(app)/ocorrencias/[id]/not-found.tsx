import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Renderizada quando `getOccurrence` lança `NotFoundError` — tanto para uma
 * ocorrência que não existe quanto para uma que existe mas não é do
 * solicitante logado. As duas situações caem na mesma tela de propósito
 * (mesma decisão do use-case, ver ADR 005): distinguir "não existe" de "não
 * é sua" na resposta vazaria, para quem não deveria saber, que o registro
 * existe.
 */
export default function OcorrenciaNaoEncontrada() {
  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Ocorrência não encontrada</h1>
          </CardTitle>
          <CardDescription>
            Ela pode não existir, ou não estar disponível para a sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/ocorrencias">Voltar para minhas ocorrências</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
