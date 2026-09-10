import { expect, test } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

test('home, guest workspace, and theme flow', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('heading', { name: '_jayawijaya' })).toBeVisible(); await page.getByRole('button', { name: 'Choose color theme' }).click(); await page.getByRole('menuitem', { name: 'Dark' }).click(); await expect(page.locator('html')).toHaveClass(/dark/); await page.getByRole('button', { name: 'Start' }).click(); await expect(page.getByRole('heading', { name: /quiz setup/i })).toBeVisible(); await expect(page.getByText(/guest workspace/i).first()).toBeVisible(); const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]) })
