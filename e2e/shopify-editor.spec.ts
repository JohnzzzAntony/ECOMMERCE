// Shopify theme-editor parity for imported Figma designs: an exact import is split into sections; the preview is
// interactive (click to select, double-click to edit text); layers behave like blocks (select, duplicate, hide);
// layer styles apply live; library sections go between Figma sections; undo; publish → storefront.
import { expect, test, type Page } from '@playwright/test'
import { E2E_ADMIN } from './global-setup'

async function login(page: Page) {
  await page.goto('/admin')
  await page.locator('#admin-email').fill(E2E_ADMIN.email)
  await page.locator('#admin-password').fill(E2E_ADMIN.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Admin Panel')).toBeVisible()
}

test('exact Figma page edits like a Shopify theme', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)

  // Connect (the token may already be saved by an earlier spec) and import only the desktop frame, exact layout.
  await page.goto('/admin?section=figma')
  const token = page.getByLabel('Personal access token')
  const connected = page.locator('[data-slot=badge]', { hasText: 'Connected' })
  await expect(token.or(connected).first()).toBeVisible()
  if (!(await connected.isVisible())) {
    await token.fill('figd_e2e_personal_access_token_00000')
    await page.getByRole('button', { name: 'Save token' }).click()
  }
  await expect(connected).toBeVisible()
  await page.goto('/admin?section=designs')
  await page.locator('#figma-link').fill('https://www.figma.com/design/AbCdEfGhIj1234567890/Medi-Store')
  await page.locator('form').getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Home \/ Desktop/ }).click()
  await page.getByRole('button', { name: 'Edit page names and types' }).click()
  await expect(page.getByLabel('Layout').first()).toHaveValue('exact')
  await page.getByRole('button', { name: /^Import \d+ pages?$/ }).click()
  await expect(page.getByRole('button', { name: 'Install as drafts' })).toBeVisible({ timeout: 120_000 })
  await page.getByRole('button', { name: 'Install as drafts' }).click()
  await expect(page.getByText('Installed as drafts').first()).toBeVisible()

  // 1. The design arrives as one section per part of the frame, named after the Figma frames.
  await page.goto('/admin?section=store-pages')
  await page.getByRole('listitem').filter({ has: page.getByText('Home', { exact: true }) }).getByRole('button', { name: 'Edit' }).click()
  const list = page.getByRole('list', { name: 'Sections' })
  await expect(list.getByRole('listitem')).toHaveCount(6)
  for (const name of ['Promo', 'Section/hero', 'Why choose us', 'Best sellers', 'Questions', 'Collage']) await expect(list.getByText(name, { exact: true })).toBeVisible()
  const preview = page.frameLocator('iframe[title="Page preview"]')
  await expect(page.locator('iframe[title="Page preview"][data-ready]')).toBeAttached() // hydrated: clicks select
  await expect(preview.locator('[data-section-type="freeform"]')).toHaveCount(6)
  await expect(preview.getByRole('heading', { level: 1 })).toHaveCount(1)

  // 2. Click to select: clicking a text in the preview selects its section and layer in the sidebar.
  await preview.getByText('Same-day delivery', { exact: true }).click()
  const inspector = page.locator('aside').last()
  await expect(inspector.getByRole('list', { name: 'Layers' })).toBeVisible()
  await expect(inspector.locator('textarea')).toHaveValue('Same-day delivery')
  await expect(list.getByRole('listitem').filter({ hasText: 'Why choose us' })).toHaveClass(/ring-1/)

  // 3. Inline text editing in the preview.
  const heading = preview.getByText('Care that moves with you', { exact: true })
  await heading.dblclick()
  await page.keyboard.type('Care at home')
  await page.keyboard.press('Enter')
  await expect(preview.getByText('Care at home', { exact: true })).toBeVisible()
  await expect(inspector.locator('textarea')).toHaveValue('Care at home')

  // 4. Layer style: font size applies live; "Use Figma value" resets it.
  const fontSize = inspector.locator('div.space-y-1\\.5').filter({ hasText: 'Font size' }).locator('input[type=range]')
  // Exact pages scale with the screen width, so compare with the Figma size (64 px) rather than absolute px.
  const size = () => preview.getByText('Care at home', { exact: true }).evaluate((el) => parseFloat(getComputedStyle(el.closest('[data-nid]')!).fontSize))
  const figma = await size()
  await fontSize.fill('32')
  await expect.poll(async () => +((await size()) / figma).toFixed(2)).toBe(0.5)
  await inspector.getByRole('button', { name: 'Use Figma value' }).click()
  await expect.poll(size).toBe(figma)

  // 5. Blocks: duplicate a card (auto layout), hide a layer; absolute layers can't be duplicated.
  await preview.getByText('Expert support', { exact: true }).click()
  await inspector.getByRole('list', { name: 'Layers' }).getByRole('button', { name: /^Card$/ }).last().click()
  await inspector.getByRole('button', { name: 'Duplicate layer' }).click()
  await expect(preview.getByText('Expert support', { exact: true })).toHaveCount(2)
  await inspector.getByRole('button', { name: 'Hide layer' }).click()
  await expect(preview.getByText('Expert support', { exact: true })).toHaveCount(1)

  // 6. Sections: hide one, add a library section after the selected one, undo the add.
  await list.getByRole('listitem').filter({ hasText: 'Collage' }).getByRole('button', { name: 'Hide section' }).click()
  await expect(preview.locator('[data-section-type="freeform"]')).toHaveCount(5)
  await list.getByText('Section/hero', { exact: true }).click()
  await page.getByRole('button', { name: 'Add section' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Rich text/ }).click()
  await expect(list.getByRole('listitem').nth(2)).toContainText('Rich text')
  await expect(preview.locator('[data-sid]').nth(2)).toHaveAttribute('data-section-type', 'rich-text')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(preview.locator('[data-section-type="rich-text"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(preview.locator('[data-section-type="rich-text"]')).toHaveCount(1)

  // 7. Links in the preview select instead of navigating.
  const before = page.url()
  await preview.getByText('Shop now', { exact: true }).click()
  expect(page.url()).toBe(before)
  await expect(preview.locator('[data-sid]').first()).toBeVisible()

  // 8. Publish; the storefront shows every edit and nothing of the editor.
  await expect(page.getByText('Draft saved')).toBeVisible()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Publish now' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Publish now' }).click()
  await expect(page.getByText(/Published version \d+/)).toBeVisible()

  await page.goto('/')
  await expect(page.getByText('Care at home', { exact: true })).toBeVisible()
  await expect(page.getByText('Expert support', { exact: true })).toHaveCount(1)
  await expect(page.locator('[data-section-type="rich-text"]')).toHaveCount(1)
  await expect(page.locator('[data-section-type="freeform"]')).toHaveCount(5)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.locator('[data-nid]')).toHaveCount(0)
  expect(errors).toEqual([])
})
