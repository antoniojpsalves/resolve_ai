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
        // Alvo real hoje (calibrado após as correções desta onda): a média de
        // `src/modules/**` é puxada para baixo por
        // `identity/infra/prisma-user-repository.ts` (0%), que depende de um
        // Postgres real e será coberto por teste de integração, não unitário
        // — fora do escopo desta correção. domain/ e application/ estão em
        // 100%; o valor abaixo é a cobertura real do diretório inteiro, para
        // não regredir, não uma meta artificialmente baixa.
        'src/modules/**': {
          statements: 71,
          branches: 49,
          functions: 69,
          lines: 71,
        },
      },
    },
  },
});
