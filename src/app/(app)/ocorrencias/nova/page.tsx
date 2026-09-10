import { requireSessionOrRedirect } from '@/core/http/auth-guards';
import { listCategories } from '@/modules/occurrence/application/list-categories';
import { prismaCategoryRepository } from '@/modules/occurrence/infra/prisma-category-repository';

import { NewOccurrenceForm } from './new-occurrence-form';

export const metadata = {
  title: 'Nova ocorrência · Resolve Aí',
};

/**
 * Server Component: a guarda de sessão e o catálogo de categorias vêm direto
 * do use-case (`listCategories`), sem um `fetch` para a própria API — mesma
 * escolha das outras telas do módulo (ver `ocorrencias/page.tsx` e
 * `ocorrencias/[id]/page.tsx`). O formulário em si é Client Component: é onde
 * mora toda a interação (upload, validação, envio).
 */
export default async function NovaOcorrenciaPage() {
  await requireSessionOrRedirect();

  const categories = await listCategories({ categories: prismaCategoryRepository });

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nova ocorrência</h1>
        <p className="text-muted-foreground text-sm">
          Descreva o problema encontrado — quanto mais detalhes, mais rápido o atendimento.
        </p>
      </div>

      <NewOccurrenceForm categories={categories} />
    </section>
  );
}
