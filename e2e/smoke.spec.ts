import { expect, test } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

test('home, sign-in gate, and theme flow', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('heading', { name: '_jayawijaya' })).toBeVisible(); await page.getByRole('button', { name: 'Choose color theme' }).click(); await page.getByRole('menuitem', { name: 'Dark' }).click(); await expect(page.locator('html')).toHaveClass(/dark/); await page.getByRole('button', { name: 'Start' }).click(); await expect(page.getByText('Sign in', { exact: true })).toBeVisible(); const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]) })
