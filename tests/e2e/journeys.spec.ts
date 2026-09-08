import path from 'node:path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * As 3 jornadas de negócio exigidas por `docs/PLANO.md` (seção 7), como um
 * único ciclo contínuo — a mesma ocorrência atravessa as três, não 3 casos
 * independentes (decisão registrada no ledger do Dia 4, Tarefa 3):
 *
 *   1. Solicitante se cadastra → login automático → abre ocorrência com
 *      imagem → vê protocolo e status `ABERTA`.
 *   2. Gestor loga → filtra por categoria → prioriza, atribui → transiciona
 *      `ABERTA → EM_ANALISE → EM_ATENDIMENTO → RESOLVIDA` → histórico com 4
 *      entradas na ordem certa.
 *   3. Solicitante volta → vê `RESOLVIDA` → avalia com 5 estrelas →
 *      comentário aparece também para o gestor.
 *
 * `test.describe.serial` garante que os 3 `test(...)` rodem no mesmo worker,
 * na ordem declarada, e pare no primeiro que falhar — necessário porque eles
 * compartilham estado de negócio (id/protocolo da ocorrência, credenciais do
 * solicitante) via variáveis no escopo deste `describe`, e porque o Postgres
 * de e2e não é resetado por teste (ao contrário dos testes de
 * integração/unitários). Cada `test()`, mesmo em modo serial, ainda recebe
 * seu próprio `page`/contexto isolado (sem cookies da jornada anterior) — é
 * por isso que a Jornada 2 loga do zero como gestor sem precisar de logout
 * explícito, e a Jornada 3 só faz logout->login *dentro* de si mesma, para
 * trocar de solicitante para gestor no passo 5.
 */

const IMAGE_FIXTURE_PATH = path.join(__dirname, 'fixtures', 'sample-occurrence.png');

// Credenciais do gestor semeadas por `prisma/seed.ts` — confirmadas ali, não
// inventadas: `gestor1@resolveai.com` / `Senha@123` (nome "Marcos Oliveira").
const MANAGER_EMAIL = 'gestor1@resolveai.com';
const MANAGER_PASSWORD = 'Senha@123';
const MANAGER_NAME = 'Marcos Oliveira';

// E-mail único por execução: o banco de e2e não é limpo entre execuções
// (ao contrário do banco de testes de integração), então um valor fixo
// colidiria com `ConflictError` (409) numa segunda rodada da suíte.
const APPLICANT_EMAIL = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const APPLICANT_PASSWORD = 'Senha@123';
const APPLICANT_NAME = 'Solicitante E2E';

const OCCURRENCE_CODE_PATTERN = /OC-\d{4}-\d{6}/;

const RATING_COMMENT = 'Atendimento resolvido rapidamente, equipe muito atenciosa.';
const RESOLUTION_NOTE = 'Equipe técnica compareceu ao local e concluiu o reparo com sucesso.';

/**
 * Abre um `<Select>` Radix (shadcn) pelo rótulo acessível e clica na opção
 * pedida — nunca `selectOption` (não é um `<select>` nativo). Mesmo padrão
 * repetido pelos 4 selects das jornadas (categoria da nova ocorrência,
 * filtro de categoria do backlog, prioridade e responsável da Gestão).
 */
async function chooseSelectOption(
  page: Page,
  labelText: string,
  optionName: string | RegExp,
): Promise<void> {
  await page.getByLabel(labelText).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/ocorrencias$/);
}

test.describe.serial('Ciclo completo de uma ocorrência', () => {
  // Preenchidos pela Jornada 1, lidos pelas Jornadas 2 e 3.
  let occurrenceId = '';
  let occurrenceCode = '';
  let categoryName = '';

  test('jornada 1 — solicitante se cadastra e abre uma ocorrência com imagem', async ({ page }) => {
    await page.goto('/cadastro');

    await page.getByLabel('Nome').fill(APPLICANT_NAME);
    await page.getByLabel('E-mail').fill(APPLICANT_EMAIL);
    await page.getByLabel('Senha', { exact: true }).fill(APPLICANT_PASSWORD);
    await page.getByLabel('Confirmar senha').fill(APPLICANT_PASSWORD);
    await page.getByRole('button', { name: 'Criar conta' }).click();

    // Login automático após o cadastro.
    await expect(page).toHaveURL(/\/ocorrencias$/);

    await page.getByRole('link', { name: 'Nova ocorrência' }).click();
    await expect(page).toHaveURL(/\/ocorrencias\/nova$/);

    await page.getByLabel('Título').fill('Vazamento no corredor do bloco B (e2e)');
    await page
      .getByLabel('Descrição')
      .fill('Ocorrência criada pela suíte e2e — vazamento visível na tubulação do corredor.');

    // Primeira opção disponível do `<Select>` de categoria (vem do seed) —
    // guardamos o nome para reutilizar como filtro na Jornada 2.
    await page.getByLabel('Categoria').click();
    const firstCategoryOption = page.getByRole('option').first();
    categoryName = (await firstCategoryOption.textContent())?.trim() ?? '';
    expect(categoryName).not.toBe('');
    await firstCategoryOption.click();

    await page.getByLabel('Localização').fill('Bloco B, corredor do 2º andar (e2e)');
    await page.getByLabel('Foto (opcional)').setInputFiles(IMAGE_FIXTURE_PATH);

    await page.getByRole('button', { name: 'Criar ocorrência' }).click();

    // Negative lookahead para `nova`: sem ele, a URL atual antes mesmo do
    // clique (`/ocorrencias/nova`) já satisfaz `/\/ocorrencias\/[^/]+$/`, e
    // `toHaveURL` resolve de imediato sem esperar a navegação real —
    // `occurrenceId` acaba capturando a string `"nova"`, que o Next.js
    // resolve para a rota estática `/ocorrencias/nova` (não a dinâmica
    // `[id]`) em qualquer navegação futura para ela.
    await expect(page).toHaveURL(/\/ocorrencias\/(?!nova\b)[^/]+$/);
    occurrenceId = page.url().split('/').pop() ?? '';
    expect(occurrenceId).not.toBe('');
    expect(occurrenceId).not.toBe('nova');

    const codeLocator = page.getByText(OCCURRENCE_CODE_PATTERN).first();
    await expect(codeLocator).toBeVisible();
    const codeText = (await codeLocator.innerText()).trim();
    occurrenceCode = codeText.match(OCCURRENCE_CODE_PATTERN)?.[0] ?? '';
    expect(occurrenceCode).toMatch(OCCURRENCE_CODE_PATTERN);

    // `StatusBadge` — `.first()` porque a mesma palavra também pode aparecer
    // num badge de histórico, dependendo do status; aqui só há uma entrada
    // de "Abertura" (rótulo diferente), mas mantemos o padrão usado nas
    // outras jornadas por consistência.
    await expect(page.getByText('Aberta', { exact: true }).first()).toBeVisible();

    // A imagem aparece com `alt` contendo o protocolo (mesmo padrão de
    // `ocorrencias/[id]/page.tsx`).
    await expect(page.getByAltText(new RegExp(occurrenceCode))).toBeVisible();
  });

  test('jornada 2 — gestor filtra, prioriza, atribui e resolve a ocorrência', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD);

    // Filtra o backlog pela mesma categoria da ocorrência criada na Jornada 1
    // e confirma que ela aparece na lista filtrada.
    await chooseSelectOption(page, 'Categoria', categoryName);
    await expect(page).toHaveURL(/categoryId=/);
    await expect(page.getByText(occurrenceCode)).toBeVisible();

    // Navegação direta por id (aceitável pelo brief) — evita depender do
    // layout exato do item da lista para localizar o link certo.
    await page.goto(`/ocorrencias/${occurrenceId}`);
    await expect(page.getByText(occurrenceCode).first()).toBeVisible();

    // Painel "Gestão": prioridade e responsável.
    await chooseSelectOption(page, 'Prioridade', 'Alta');
    await expect(page.getByLabel('Prioridade')).toHaveText('Alta');

    await page.getByLabel('Responsável').click();
    const assignOptions = page.getByRole('option');
    const optionCount = await assignOptions.count();
    let assigneeName: string | null = null;
    for (let index = 0; index < optionCount; index += 1) {
      const text = (await assignOptions.nth(index).textContent())?.trim();
      if (text && text !== 'Ninguém' && text !== MANAGER_NAME) {
        assigneeName = text;
        break;
      }
    }
    // Se o seed só tiver um gestor, atribuir a si mesmo não é um problema
    // (o brief autoriza esse fallback explicitamente).
    assigneeName ??= MANAGER_NAME;
    await page.getByRole('option', { name: assigneeName, exact: true }).click();
    await expect(page.getByLabel('Responsável')).toHaveText(assigneeName);

    // Painel "Ações": ABERTA -> EM_ANALISE -> EM_ATENDIMENTO -> RESOLVIDA.
    await page.getByRole('button', { name: 'Em análise', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('button', { name: 'Em atendimento', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Em atendimento', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('button', { name: 'Resolvida', exact: true })).toBeVisible();

    // `RESOLVIDA` exige `resolutionNote` — confirma que submeter vazio é
    // barrado (a validação client-side transforma '' em `undefined`, então
    // quem barra de fato é o servidor, via 422) antes de preencher e ter
    // sucesso.
    await page.getByRole('button', { name: 'Resolvida', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    // `filter({ hasText })`: o Next.js também expõe um `role="alert"` próprio
    // (`__next-route-announcer__`, sempre vazio) — sem o filtro, o locator
    // resolve para 2 elementos e vira violação de strict mode.
    await expect(page.getByRole('alert').filter({ hasText: 'resolutionNote' })).toBeVisible();

    await page.getByLabel('Observação (obrigatória)').fill(RESOLUTION_NOTE);
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // Status terminal: `StatusBadge` mostra "Resolvida" e o painel "Ações"
    // some por completo (nenhuma transição disponível).
    await expect(page.getByText('Resolvida', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ações' })).toHaveCount(0);

    // Histórico: exatamente 4 entradas, na ordem cronológica certa. `list`
    // é o role implícito tanto do `<ol>` do Histórico quanto do `<ul>` de
    // Comentários — `filter({ hasText: ... })` usa o texto exclusivo da
    // entrada de abertura para escolher a lista certa sem sair de
    // `getByRole`.
    const historyList = page.getByRole('list').filter({ hasText: 'Ocorrência aberta por' });
    const historyItems = historyList.getByRole('listitem');
    await expect(historyItems).toHaveCount(4);
    await expect(historyItems.nth(0)).toContainText(`Ocorrência aberta por ${APPLICANT_NAME}`);
    await expect(historyItems.nth(1)).toContainText('Você alterou o status para Em análise');
    await expect(historyItems.nth(2)).toContainText('Você alterou o status para Em atendimento');
    await expect(historyItems.nth(3)).toContainText('Você alterou o status para Resolvida');
  });

  test('jornada 3 — solicitante avalia e o gestor vê a avaliação', async ({ page }) => {
    await login(page, APPLICANT_EMAIL, APPLICANT_PASSWORD);

    await page.goto(`/ocorrencias/${occurrenceId}`);
    await expect(page.getByText('Resolvida', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Avaliar com 5 estrelas' }).click();
    await page.getByLabel('Comentário (opcional)').fill(RATING_COMMENT);
    // `exact: true`: sem ele, "Avaliar" (substring) também casa com os 5
    // botões "Avaliar com N estrela(s)" — strict mode violation.
    await page.getByRole('button', { name: 'Avaliar', exact: true }).click();

    // O formulário de avaliação some e um card read-only aparece no lugar.
    await expect(page.getByRole('heading', { name: 'Avaliar atendimento' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Avaliação' })).toBeVisible();
    await expect(page.getByText(RATING_COMMENT)).toBeVisible();

    // Troca de usuário dentro do mesmo teste: o middleware redireciona quem
    // já está autenticado para longe de `/login`, então o logout explícito
    // (botão "Sair") é necessário antes de logar como gestor.
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD);
    await page.goto(`/ocorrencias/${occurrenceId}`);

    // RBAC de leitura (Dia 3): o comentário da avaliação também aparece
    // para o gestor.
    await expect(page.getByText(RATING_COMMENT)).toBeVisible();
  });
});
