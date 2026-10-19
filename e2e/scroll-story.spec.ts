// Scroll story (Figma screens linked by arrow keys) on the storefront: wheel, keyboard and lock during the smart
// animate; editor: choose a scene, upload a video onto a layer, publish → the storefront plays it.
import { expect, test, type Page } from '@playwright/test'
import { buildIR, framePages, type RawSnapshot } from '../src/backend/lib/design-import/pipeline'
import { mapPage } from '../src/backend/lib/design-import/mapping'
import { E2E_ADMIN } from './global-setup'

async function login(page: Page) {
  await page.goto('/admin')
  await page.locator('#admin-email').fill(E2E_ADMIN.email)
  await page.locator('#admin-password').fill(E2E_ADMIN.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Admin Panel')).toBeVisible()
}

const box = (x: number, y: number, width: number, height: number) => ({ absoluteBoundingBox: { x, y, width, height } })
const key = (code: number, dest: string) => ({ trigger: { type: 'ON_KEY_DOWN', device: 'KEYBOARD', keyCodes: [code] }, actions: [{ type: 'NODE', navigation: 'NAVIGATE', destinationId: dest, transition: { type: 'SMART_ANIMATE', duration: 0.8, easing: { type: 'EASE_OUT' } } }] })
const screen = (id: string, x: number, title: string, color: { r: number; g: number; b: number }, interactions: unknown[]) => ({
  id, name: 'Story', type: 'FRAME', fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }], ...box(x, 0, 1280, 720),
  children: [
    { id: `${id}-bg`, name: 'Backdrop', type: 'RECTANGLE', fills: [{ type: 'SOLID', color }], ...box(x, 0, 1280, 720) },
    { id: `${id}-t`, name: 'Title', type: 'TEXT', characters: title, style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 48 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }], ...box(x + 80, 300, 800, 60), interactions },
  ],
})
const raw: RawSnapshot = {
  file: { name: 'Story', version: '1', lastModified: '' },
  nodes: {
    '7:1': { document: screen('7:1', 0, 'Scene one', { r: 0.9, g: 0.85, b: 0.8 }, [key(40, '7:2')]) as never },
    '7:2': { document: screen('7:2', 1400, 'Scene two', { r: 0.2, g: 0.2, b: 0.25 }, [key(40, '7:3'), key(38, '7:1')]) as never },
    '7:3': { document: screen('7:3', 2800, 'Scene three', { r: 0.6, g: 0.5, b: 0.4 }, [key(38, '7:2')]) as never },
  },
}
const plan = ['7:1', '7:2', '7:3'].map((id, i) => ({ title: 'Story', type: 'PAGE' as const, slug: i ? `story-${i}` : 'story', layout: 'exact' as const, frames: { desktop: id } }))

/** A short real WebM recorded in the browser (canvas + MediaRecorder). */
async function recordWebm(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 160, height: 90 })
    const ctx = canvas.getContext('2d')!
    const rec = new MediaRecorder(canvas.captureStream(15), { mimeType: 'video/webm' })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    rec.start()
    for (let i = 0; i < 12; i++) { ctx.fillStyle = `hsl(${i * 30}, 70%, 50%)`; ctx.fillRect(0, 0, 160, 90); await new Promise((r) => setTimeout(r, 60)) }
    await new Promise((r) => { rec.onstop = r; rec.stop() })
    const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())
    let s = ''; for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
  })
  return Buffer.from(b64, 'base64')
}

test('scroll story: scroll through scenes with smart animate; video on a layer', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)

  // The page as the import pipeline builds it from the prototype.
  const ir = buildIR(raw, plan, 'AbCdEfGhIj1234567890')
  expect(ir.pages).toHaveLength(1)
  const { sections } = mapPage(ir.pages[0], 'AbCdEfGhIj1234567890', { saved: new Map(), framePages: framePages(plan, ir.pages), variants: ir.variants })
  // The storefront goes live with a published home page: the story is the home page (an earlier spec may have one).
  const res = await page.request.post('/api/design/pages', { data: { type: 'HOME', title: 'Story' } })
  const created = res.ok() ? await res.json() : (await (await page.request.get('/api/design/pages')).json()).find((p: { type: string }) => p.type === 'HOME')
  const draft = await (await page.request.get(`/api/design/pages/${created.id}`)).json()
  const put = await page.request.put(`/api/design/pages/${created.id}/draft`, { data: { sections, revision: draft.draft.revision } })
  expect(put.ok()).toBe(true)

  // Editor: the layer panel lists the scenes; choosing one shows it in the preview.
  await page.goto('/admin?section=store-pages')
  await page.getByRole('listitem').filter({ has: page.getByText(created.title, { exact: true }) }).getByRole('button', { name: 'Edit' }).click()
  const preview = page.frameLocator('iframe[title="Page preview"]')
  await expect(page.locator('iframe[title="Page preview"][data-ready]')).toBeAttached() // hydrated: clicks select
  await expect(preview.getByText('Scene one', { exact: true })).toBeVisible()
  await page.getByRole('list', { name: 'Sections' }).getByRole('listitem').first().getByRole('button').nth(1).click()
  const inspector = page.locator('aside').last()
  const design = inspector.getByLabel('Design')
  await expect(design.locator('option')).toHaveText(['Scene 1', 'Scene 2', 'Scene 3'])
  await design.selectOption({ label: 'Scene 3' })
  await expect(preview.getByText('Scene three', { exact: true })).toBeVisible()
  await design.selectOption({ label: 'Scene 1' })
  await expect(preview.getByText('Scene one', { exact: true })).toBeVisible()

  // Video: select the backdrop layer in the preview, upload a video onto it.
  const backdrop = preview.locator('[data-nid="7:1-bg"]')
  const bb = (await backdrop.boundingBox())!
  await backdrop.click({ position: { x: bb.width * 0.9, y: bb.height * 0.1 } })
  await expect(inspector.getByText('Video', { exact: true })).toBeVisible()
  await inspector.getByRole('button', { name: 'Upload' }).click()
  const webm = await recordWebm(page)
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'hero.webm', mimeType: 'video/webm', buffer: webm })
  const tile = page.getByRole('dialog').locator('button:has(video)').first()
  await expect(tile).toBeVisible()
  await tile.click()
  await expect(preview.locator('[data-nid="7:1-bg"] video')).toHaveAttribute('src', /\/api\/design\/storage\/tenants\/legacy\/videos\/[a-f0-9]+\.webm$/)

  await expect(page.getByText('Draft saved')).toBeVisible()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publish now' }).click()
  await expect(page.getByText(/Published version \d+/)).toBeVisible()

  // Storefront: the first scene with its video; wheel → scene 2 (animated), locked while animating; keys; back up.
  await page.goto('/')
  await expect(page.getByText('Scene one', { exact: true })).toBeVisible()
  await expect(page.locator('video')).toHaveJSProperty('muted', true)
  await page.mouse.move(640, 300)
  await page.mouse.wheel(0, 120)
  await expect(page.getByText('Scene two', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0) // smart animate running
  await page.mouse.wheel(0, 120) // ignored while the transition runs
  await page.waitForTimeout(300)
  await expect(page.getByText('Scene two', { exact: true })).toBeVisible()
  await page.waitForTimeout(900)
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('Scene three', { exact: true })).toBeVisible()
  await page.waitForTimeout(1100)
  await page.mouse.wheel(0, -120)
  await expect(page.getByText('Scene two', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5) // the page itself didn't scroll
  expect(errors).toEqual([])
})
