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
      thresholds: {
        // Plano §7: domain/ é o argumento mais forte da arquitetura e exige
        // ≥80% de cobertura — hoje está em 100% (só `user.ts`/`protocol.ts`
        // têm código executável; `role.ts` é só tipo, sem runtime).
        'src/modules/**/domain/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        // Alvo real hoje (recalibrado): a média de
        // `src/modules/**` é puxada para baixo por três implementações
        // Prisma em 0% — `identity/infra/prisma-user-repository.ts`,
        // `occurrence/infra/prisma-occurrence-repository.ts` e
        // `occurrence/infra/prisma-category-repository.ts` — que dependem de
        // um Postgres real e serão cobertas por teste de integração, não
        // unitário, no mesmo padrão já estabelecido para a primeira.
        // `occurrence/infra/mappers.ts` é a exceção: são funções puras de
        // tradução Prisma → application, sem chamada ao Prisma, por isso
        // testadas com fixtures no formato de linha do Prisma (sem banco) e
        // cobertas normalmente. domain/ e application/ continuam em ~100%;
        // os valores abaixo são a cobertura real do diretório inteiro após
        // esta tarefa, para não regredir, não uma meta artificialmente baixa.
        'src/modules/**': {
          statements: 64,
          branches: 49,
          functions: 69,
          lines: 66,
        },
      },
    },
  },
});
