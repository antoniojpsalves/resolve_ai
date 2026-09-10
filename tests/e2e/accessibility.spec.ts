import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Varredura automatizada de acessibilidade (axe-core) nas telas principais.
 * Decisão de manter isto na suíte permanente (não
 * só como verificação pontual): o custo é baixo (poucos segundos, roda no
 * mesmo `webServer` já usado por `journeys.spec.ts`) e captura regressões de
 * acessibilidade automaticamente (contraste, label ausente, `aria-*`
 * inválido) que review manual pode deixar passar.
 *
 * Escopo do axe: `wcag2a` + `wcag2aa` (label, contraste, estrutura de
 * heading/landmark, nome acessível) — não roda as regras `best-practice`,
 * mais subjetivas/ruidosas e fora do que o WCAG exige.
 *
 * Credenciais reaproveitadas de `journeys.spec.ts` (seed de
 * `prisma/seed.ts`) — mesmo par gestor/solicitante, mesmo motivo de não
 * inventar dado novo.
 */
const MANAGER_EMAIL = 'gestor1@resolveai.com';
const MANAGER_PASSWORD = 'Senha@123';
const APPLICANT_EMAIL = 'ana@resolveai.com';
const APPLICANT_PASSWORD = 'Senha@123';

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/ocorrencias$/);
}

async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(' ')),
  }));

  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe('Acessibilidade (axe-core, wcag2a + wcag2aa)', () => {
  test('/login', async ({ page }) => {
    await page.goto('/login');
    await expectNoSeriousViolations(page);
  });

  test('/cadastro', async ({ page }) => {
    await page.goto('/cadastro');
    await expectNoSeriousViolations(page);
  });

  test('/ocorrencias (solicitante)', async ({ page }) => {
    await login(page, APPLICANT_EMAIL, APPLICANT_PASSWORD);
    await expectNoSeriousViolations(page);
  });

  test('/ocorrencias/nova', async ({ page }) => {
    await login(page, APPLICANT_EMAIL, APPLICANT_PASSWORD);
    await page.goto('/ocorrencias/nova');
    await expectNoSeriousViolations(page);
  });

  test('/ocorrencias (gestor, com filtros ativos)', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD);
    await page.goto('/ocorrencias?status=ABERTA&priority=ALTA');
    await expectNoSeriousViolations(page);
  });

  test('/dashboard (gestor)', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD);
    await page.goto('/dashboard');
    // Os 3 gráficos Recharts terminam de montar (`<svg>`) de forma assíncrona.
    await page.waitForSelector('svg', { timeout: 10_000 }).catch(() => {});
    await expectNoSeriousViolations(page);
  });

  test('/ocorrencias/[id] (detalhe, gestor)', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD);
    await page.goto('/ocorrencias');
    await page.locator('a[href^="/ocorrencias/"]:not([href="/ocorrencias/nova"])').first().click();
    await expect(page).toHaveURL(/\/ocorrencias\/[^/]+$/);
    await expectNoSeriousViolations(page);
  });
});
