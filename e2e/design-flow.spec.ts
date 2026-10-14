// Connect Figma (mocked OAuth) → pick frames → import → review → install → edit → publish → storefront renders
// (axe: no critical violations; visual diff vs the Figma render is reported) → rollback.
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { E2E_ADMIN } from './global-setup'

test.describe.configure({ mode: 'serial' })

async function login(page: Page) {
  await page.goto('/admin')
  await page.locator('#admin-email').fill(E2E_ADMIN.email)
  await page.locator('#admin-password').fill(E2E_ADMIN.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Admin Panel')).toBeVisible()
}

const field = (page: Page, label: string) => page.locator('div.space-y-1\\.5').filter({ has: page.getByText(label, { exact: true }) }).first()

async function publishCurrentPage(page: Page) {
  await expect(page.getByText('Draft saved')).toBeVisible()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Publish now' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Publish now' }).click()
  await expect(page.getByText(/Published version \d+/)).toBeVisible()
}

test('Figma design → published storefront page → rollback', async ({ page }, testInfo) => {
  await login(page)

  // 1. Connect Figma with (mocked) OAuth.
  await page.goto('/admin?section=figma')
  await page.getByRole('button', { name: 'Connect with Figma' }).click()
  await expect(page.locator('[data-slot=badge]', { hasText: 'Connected' })).toBeVisible()
  await expect(page.getByText('E2E Designer')).toBeVisible()

  // 2. Pick frames and queue the import.
  await page.goto('/admin?section=designs')
  await page.locator('#figma-link').fill('https://www.figma.com/design/AbCdEfGhIj1234567890/Medi-Store')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Home \/ Desktop/ }).click()
  await page.getByRole('button', { name: /Home \/ Mobile/ }).click()
  await expect(page.getByText('Pages to create (1)')).toBeVisible()
  await page.getByRole('button', { name: 'Queue import' }).click()
  await expect(page.getByText('Import queued')).toBeVisible()

  // 3. Review and install.
  await page.getByRole('button', { name: 'Open', exact: true }).or(page.getByRole('button', { name: 'Review', exact: true })).last().click()
  await expect(page.getByRole('button', { name: 'Install as drafts' })).toBeVisible({ timeout: 120_000 })
  await expect(page.getByLabel('Section type').nth(1)).toHaveValue('hero')
  await page.getByRole('button', { name: 'Install as drafts' }).click()
  await expect(page.getByText('Installed as drafts')).toBeVisible()

  // 4. Edit: alt text and a button destination (the design linked to a frame that wasn't imported).
  await page.goto('/admin?section=store-pages')
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await page.getByRole('button', { name: /Care that moves with you/ }).click()
  await page.getByLabel('Alt text').first().fill('Nurse helping a patient at home')
  const link = field(page, 'Button link')
  await link.locator('select').first().selectOption('url')
  await link.locator('input').first().fill('https://example.com/shop')
  await publishCurrentPage(page)

  // 5. Storefront renders the published page, accessibly.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Care that moves with you' })).toBeVisible()
  await expect(page.locator('[data-section-type="feature-grid"]')).toContainText('Same-day delivery')
  const axe = await new AxeBuilder({ page }).analyze()
  const critical = axe.violations.filter((v) => v.impact === 'critical')
  expect(critical.map((v) => v.id)).toEqual([])

  // Visual regression: rendered hero vs the Figma frame render (diff % reported as an attachment).
  const hero = page.locator('[data-section-type="hero"]')
  const shot = PNG.sync.read(await hero.screenshot())
  const render = PNG.sync.read(Buffer.from(await (await page.request.get('http://127.0.0.1:4010/assets/png/10%3A1')).body()))
  const width = Math.min(shot.width, render.width), height = Math.min(shot.height, render.height)
  const crop = (img: PNG) => { const out = new PNG({ width, height }); PNG.bitblt(img, out, 0, 0, width, height, 0, 0); return out }
  const diff = new PNG({ width, height })
  const changed = pixelmatch(crop(shot).data, crop(render).data, diff.data, width, height, { threshold: 0.2 })
  const percent = +((changed / (width * height)) * 100).toFixed(2)
  await testInfo.attach('visual-diff.json', { body: JSON.stringify({ section: 'hero', width, height, diffPercent: percent }), contentType: 'application/json' })
  await testInfo.attach('visual-diff.png', { body: PNG.sync.write(diff), contentType: 'image/png' })
  console.log(`Visual diff (hero vs Figma render): ${percent}%`)

  // 6. Change and publish again, then roll back to version 1.
  await page.goto('/admin?section=store-pages')
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await page.getByRole('button', { name: /Free delivery over 500 AED/ }).click()
  await field(page, 'Message').locator('input').fill('Summer sale this week')
  await publishCurrentPage(page)
  await page.goto('/')
  await expect(page.getByText('Summer sale this week')).toBeVisible()

  await page.goto('/admin?section=store-pages')
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await page.getByRole('button', { name: 'History' }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('listitem').filter({ hasText: 'v1' }).getByRole('button', { name: /Restore/ }).click()
  await expect(page.getByText('Rolled back')).toBeVisible()
  await page.goto('/')
  await expect(page.getByText('Free delivery over 500 AED')).toBeVisible()
})
