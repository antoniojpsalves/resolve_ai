import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/core/**', 'src/modules/**'],
      // Threshold por camada, não por um glob blended: `domain/`, `application/`
      // e `infra/` têm propriedades de teste incompatíveis entre si —
      // `domain/` e `application/` são 100% testáveis com fakes em memória,
      // sem banco; `infra/` (as implementações Prisma) é estruturalmente baixa
      // porque a cobertura de verdade dela só vem de teste de integração
      // contra Postgres real (fora de escopo aqui). Um único piso
      // "src/modules/**" misturando as três já obrigou a baixar o número duas
      // vezes (já aconteceu uma vez) — a cada novo
      // repositório Prisma o denominador cresce, a média cai de novo, e a
      // "correção" vira abaixar o piso outra vez: um gate de fachada. Os três
      // globs abaixo são mutuamente exclusivos (todo .ts de `src/modules/**`
      // mora em domain/, application/ ou infra/ de algum módulo — confirmado
      // por inspeção do `coverage/lcov.info` gerado por `npm run test:cov`,
      // sem nenhum arquivo sobrando fora dos três). Confirmado empiricamente
      // (rodando com dois globs sobrepostos de propósito, um deles
      // 'src/modules/**') que o vitest calcula e checa cada glob de threshold
      // de forma independente sobre os arquivos que casam com ele — não há
      // "o último glob vence" nem conflito quando um arquivo casa com mais de
      // um padrão; por isso não sobra motivo para manter também um glob
      // blended: ele só reintroduziria a mistura de camadas que este comentário
      // descreve, sem checar nada que os três já não cubram.
      thresholds: {
        // Plano §7: domain/ é o argumento mais forte da arquitetura e exige
        // ≥80% de cobertura — hoje está em 100% (só `user.ts`/`protocol.ts`/
        // `occurrence.ts`/etc. têm código executável; `role.ts` é só tipo).
        'src/modules/**/domain/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        // Piso alto com folga real: hoje application/ (identity + occurrence)
        // mede statements 98.24% / branches 96.15% / functions 100% /
        // lines 98.21% — todo testado com fakes em memória, sem banco. 90
        // deixa uns 6 a 10 pontos de margem em cada métrica (o bastante para
        // um branch ou função nova aterrissar sem teste por um commit e não
        // travar o CI por acidente) sem abrir mão de pegar uma regressão de
        // verdade — por exemplo, um use-case novo sem nenhum teste
        // (confirmado experimentalmente: comentar
        // list-occurrences.test.ts derruba esse número bem abaixo de 90).
        'src/modules/**/application/**': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
        // Piso baixo e honesto: hoje infra/ (identity + occurrence) mede
        // statements 13.84% / branches 5.71% / functions 38.09% / lines 15% —
        // as implementações Prisma (prisma-user-repository.ts,
        // prisma-occurrence-repository.ts, prisma-category-repository.ts)
        // continuam em 0% de teste unitário, por design (dependem de
        // Postgres real; virão testes de integração depois). Os números
        // abaixo ficam alguns pontos abaixo do real de hoje só para não ficar
        // rente ao valor atual — não existe meta de "subir" aqui dentro desta
        // etapa; a meta de verdade é a suíte de integração contra banco.
        // `mappers.ts` (funções puras de tradução Prisma → application, sem
        // chamar o Prisma) é a exceção dentro de infra/ e já está 100%
        // coberto, o que também mora nesta média.
        'src/modules/**/infra/**': {
          statements: 10,
          branches: 5,
          functions: 30,
          lines: 12,
        },
      },
    },
  },
});
