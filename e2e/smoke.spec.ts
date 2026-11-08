// Smoke: the storefront renders without page errors or critical accessibility violations, and an admin can sign in.
import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { E2E_ADMIN } from './global-setup'

test('storefront home renders with no critical accessibility violations', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const res = await page.goto('/')
  expect(res?.status()).toBe(200)
  await expect(page.locator('main, body').first()).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.filter((v) => v.impact === 'critical').map((v) => `${v.id}: ${v.help}`)).toEqual([])
  expect(errors).toEqual([])
})

test('admin signs in', async ({ page }) => {
  await page.goto('/admin')
  await page.locator('#admin-email').fill(E2E_ADMIN.email)
  await page.locator('#admin-password').fill(E2E_ADMIN.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Admin Panel')).toBeVisible()
})
