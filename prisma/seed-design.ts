// Demo tenant with a Figma import installed from the recorded fixtures (no Figma account or network needed).
//   bun prisma/seed-design.ts            (refuses to run unless SEED_DESIGN_DEMO=1)
// Creates store "demo" (domain demo.localhost), an OWNER membership for ADMIN_EMAIL, a FigmaFile + INSTALLED import
// built by the real normalizer/mapping/tokens code from tests/__fixtures__/figma/nodes-store.json, a published home
// page, header/footer globals and an active design system. Images point at placeholders (the asset stage needs Figma).
import { PrismaClient } from '@prisma/client'
import fixture from '../tests/__fixtures__/figma/nodes-store.json'
import { buildIR, framePages } from '../src/backend/lib/design-import/pipeline'
import { extractTokens } from '../src/backend/lib/design-import/tokens'
import { mapPage } from '../src/backend/lib/design-import/mapping'
import { validateSection, defaultSettings, newId, type SectionInstance } from '../src/shared/sections/registry'

if (process.env.SEED_DESIGN_DEMO !== '1') {
  console.error('Set SEED_DESIGN_DEMO=1 to create the demo store (check DATABASE_URL points at a development database).')
  process.exit(1)
}

const db = new PrismaClient()
const STORE = 'demo'
const PLACEHOLDER = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'

/** Every write sets app.store_id so row level security admits it. */
async function asStore<T>(fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) {
  return db.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config('app.store_id', ${STORE}, TRUE)`; return fn(tx) })
}

const fill = (v: unknown): unknown => Array.isArray(v) ? v.map(fill) : v && typeof v === 'object'
  ? (typeof (v as { url?: unknown }).url === 'string' && String((v as { url: string }).url).startsWith('pending:')
    ? { ...(v as object), url: PLACEHOLDER, alt: (v as { alt?: string }).alt || 'Demo image', decorative: false }
    : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'tree' ? x : fill(x)])))
  : v

async function main() {
  await db.store.upsert({ where: { id: STORE }, update: {}, create: { id: STORE, slug: STORE, name: 'NexEcoms Demo', domain: 'demo.localhost', designSource: 'FIGMA' } })
  const admin = process.env.ADMIN_EMAIL ? await db.user.findUnique({ where: { email: process.env.ADMIN_EMAIL.toLowerCase() } }) : null

  const plan = [{ title: 'Home', type: 'HOME' as const, frames: { desktop: '10:1', mobile: '10:2' } }]
  const ir = buildIR({ file: { name: fixture.name, version: 'demo-1', lastModified: fixture.lastModified }, nodes: fixture.nodes as never }, plan, 'DemoFixtureFile0001')
  const { tokens } = extractTokens(ir)
  const mapped = mapPage(ir.pages[0], 'DemoFixtureFile0001', { saved: new Map(), framePages: framePages(plan) })
  const sections = (fill(mapped.sections) as SectionInstance[]).map((s) => (s.type === 'hero' ? { ...s, settings: { ...s.settings, ctaLink: { kind: 'collection', slug: 'all' } } } : s))
  for (const s of sections) { const v = validateSection(s); if (!v.ok) throw new Error(`Fixture section ${s.type} invalid: ${JSON.stringify(v.issues)}`) }
  const global = (type: 'header' | 'footer', settings: Record<string, unknown>) => [{ id: newId(), type, figmaNodeId: null, settings: { ...defaultSettings(type), ...settings }, blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1 }]

  await asStore(async (tx) => {
    if (admin) await tx.storeMember.upsert({ where: { storeId_userId: { storeId: STORE, userId: admin.id } }, update: { role: 'OWNER' }, create: { storeId: STORE, userId: admin.id, role: 'OWNER' } })
    const file = await tx.figmaFile.upsert({
      where: { storeId_fileKey_branchKey: { storeId: STORE, fileKey: 'DemoFixtureFile0001', branchKey: '' } }, update: {},
      create: { storeId: STORE, fileKey: 'DemoFixtureFile0001', name: fixture.name, version: 'demo-1', lastModified: new Date(fixture.lastModified) },
    })
    const imp = await tx.designImport.create({
      data: { storeId: STORE, fileId: file.id, figmaVersion: 'demo-1', status: 'INSTALLED', installedAt: new Date(), selectedNodeIds: ['10:1', '10:2'], pageAssignments: plan, result: { tokens, pages: [{ ...mapped, sections }], assetsDone: true } as object, warnings: ir.warnings as object[], createdBy: admin?.id ?? 'seed' },
    })
    const lastDs = await tx.designSystem.findFirst({ where: { storeId: STORE }, orderBy: { version: 'desc' } })
    await tx.designSystem.updateMany({ where: { storeId: STORE, status: 'ACTIVE' }, data: { status: 'ARCHIVED' } })
    await tx.designSystem.create({ data: { storeId: STORE, importId: imp.id, version: (lastDs?.version ?? 0) + 1, status: 'ACTIVE', tokens } })
    const pages: [string, 'HOME' | 'HEADER' | 'FOOTER', string, unknown[]][] = [
      ['', 'HOME', 'Home', sections],
      ['_header', 'HEADER', 'Header', global('header', { logoText: 'NexEcoms Demo', menu: [{ label: 'Shop', link: { kind: 'collection', slug: 'all' } }, { label: 'Cart', link: { kind: 'page', slug: '_cart' } }] })],
      ['_footer', 'FOOTER', 'Footer', global('footer', { copyright: '© NexEcoms Demo' })],
    ]
    for (const [slug, type, title, content] of pages) {
      const page = await tx.storePage.upsert({ where: { storeId_slug: { storeId: STORE, slug } }, update: {}, create: { storeId: STORE, slug, type, title, seo: { title } } })
      const last = await tx.storePageVersion.findFirst({ where: { pageId: page.id }, orderBy: { version: 'desc' } })
      await tx.storePageVersion.updateMany({ where: { pageId: page.id, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } })
      const v = await tx.storePageVersion.create({ data: { storeId: STORE, pageId: page.id, version: (last?.version ?? 0) + 1, sections: content as object[], status: 'PUBLISHED', publishedAt: new Date(), sourceImportId: imp.id, createdBy: admin?.id ?? 'seed' } })
      await tx.storePage.update({ where: { id: page.id }, data: { publishedVersionId: v.id } })
    }
  })
  console.log('Demo store ready: http://demo.localhost:3000 (store "demo")')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
