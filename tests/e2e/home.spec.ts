import { expect, test } from '@playwright/test';

// Smoke test mínimo: apenas garante que a aplicação sobe e responde.
// As jornadas de negócio completas estão em `journeys.spec.ts`.
test('a página inicial responde com status 200', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
});
