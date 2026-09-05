import { expect, test } from '@playwright/test';

// Teste mínimo de fundação: apenas garante que a aplicação sobe e responde.
// As jornadas de negócio de fato ficam para o Dia 4.
test('a página inicial responde com status 200', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
});
