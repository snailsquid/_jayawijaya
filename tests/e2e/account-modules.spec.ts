import { expect, test, type Page } from '@playwright/test';

async function signUp(page: Page, identity: string) {
  const credentials = { name: identity, email: `${identity}-${Date.now()}@example.com`, password: 'secure-password-123' };
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: { origin: 'http://127.0.0.1:5173' },
    data: credentials,
  });
  expect(response.ok()).toBeTruthy();
  return credentials;
}

test('anonymous visitors can use the guest workspace', async ({ page }) => {
  await page.goto('/start');
  await expect(page.getByRole('heading', { name: /quiz setup/i })).toBeVisible();
  await expect(page.getByText(/guest workspace/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /leave guest workspace/i })).toBeVisible();
});

test('OAuth callback paths are handled by Better Auth, not the SPA', async ({ request }) => {
  const response = await request.get('/api/auth/callback/google');
  const body = await response.text();
  expect(body).not.toContain('<div id="root">');
  expect(body).toContain('state_not_found');
});

test('imports legacy device modules once into the signed-in account', async ({ page }) => {
  await signUp(page, 'legacy-user');
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('jayawijaya-modules', JSON.stringify([{
    id: 'legacy', title: 'Legacy Module', hash: 'legacy-hash',
    questions: [{ question: 'Migrated?', answers: ['Yes', 'No'], correct_answer: 1 }],
  }])));
  await page.goto('/start');
  await page.getByRole('button', { name: /import modules/i }).click();
  await expect(page.getByText('Legacy Module')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('jayawijaya-modules'))).toBeNull();
});

test('account can upload and retain a private module', async ({ page }) => {
  await signUp(page, 'alice');
  await page.goto('/start');
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
  await page.getByRole('button', { name: /new module/i }).click();
  await page.getByRole('menuitem', { name: /write yaml code/i }).click();
  await page.getByRole('textbox', { name: /paste yaml content/i }).fill(`title: E2E Liver Module
questions:
  - question: The liver is in which quadrant?
    answers: [RUQ, LUQ]
    correct_answer: 1`);
  await page.getByRole('button', { name: /^finish$/i }).click();
  await expect(page.getByText('E2E Liver Module')).toBeVisible();
  await page.reload();
  await expect(page.getByText('E2E Liver Module')).toBeVisible();
  await page.getByRole('button', { name: /new module/i }).click();
  await page.getByRole('menuitem', { name: /write yaml code/i }).click();
  await page.getByRole('textbox', { name: /paste yaml content/i }).fill(`title: E2E Liver Module
questions:
  - question: The liver is in which quadrant?
    answers: [RUQ, LUQ]
    correct_answer: 1`);
  await page.getByRole('button', { name: /^finish$/i }).click();
  await expect(page.getByText(/already uploaded/i)).toBeVisible();
  await page.getByRole('button', { name: /cancel/i }).click();
  await page.getByRole('checkbox', { name: 'E2E Liver Module' }).click();
  await page.getByRole('button', { name: /start quiz/i }).click();
  await page.getByRole('radio', { name: 'RUQ' }).click();
  await page.getByRole('button', { name: /submit answer/i }).click();
  await page.getByRole('button', { name: /^finish$/i }).click();
  await page.getByRole('button', { name: /finish quiz/i }).click();
  await expect(page.getByRole('heading', { name: /results/i })).toBeVisible();
  await page.getByRole('button', { name: /retry/i }).first().click();
  await expect(page.getByText('The liver is in which quadrant?')).toBeVisible();
  await page.getByRole('radio', { name: 'RUQ' }).click();
  await page.getByRole('button', { name: /submit answer/i }).click();
  await page.getByRole('button', { name: /^finish$/i }).click();
  await page.getByRole('button', { name: /finish quiz/i }).click();
  await page.getByRole('button', { name: /^setup$/i }).first().click();
  await page.getByRole('button', { name: /log out/i }).click();
  await page.goBack();
  await expect(page.getByText('The liver is in which quadrant?')).toHaveCount(0);
});

test('an expired session does not remove an active quiz snapshot', async ({ page }) => {
  const original = await signUp(page, 'quiz-user');
  await page.goto('/start');
  await page.getByRole('button', { name: /new module/i }).click();
  await page.getByRole('menuitem', { name: /write yaml code/i }).click();
  await page.getByRole('textbox', { name: /paste yaml content/i }).fill(`title: Session Module
questions:
  - question: Continue after expiry?
    answers: [Yes, No]
    correct_answer: 1`);
  await page.getByRole('button', { name: /^finish$/i }).click();
  await page.getByRole('checkbox', { name: 'Session Module' }).click();
  await page.getByRole('button', { name: /^start quiz$/i }).click();
  await expect(page.getByText('Continue after expiry?')).toBeVisible();
  await page.context().clearCookies();
  await page.reload();
  await expect(page.getByText('Continue after expiry?')).toHaveCount(0);
  await expect(page.getByText(/quiz is safe/i)).toBeVisible();
  const login = await page.request.post('/api/auth/sign-in/email', {
    headers: { origin: 'http://127.0.0.1:5173' },
    data: { email: original.email, password: original.password },
  });
  expect(login.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByText('Continue after expiry?')).toBeVisible();
  await expect(page.getByText(/quiz is safe/i)).toHaveCount(0);
  await page.context().clearCookies();
  await signUp(page, 'other-user');
  await page.reload();
  await expect(page.getByText(/belongs to another account/i)).toBeVisible();
});
