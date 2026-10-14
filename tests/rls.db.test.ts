// Row level security against a real, migrated Postgres database. Skipped unless TEST_DATABASE_URL points at a
// disposable database (never the one in DATABASE_URL). Connect as a role without BYPASSRLS.
//   TEST_DATABASE_URL=postgres://… bun test tests/rls.db.test.ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && url !== process.env.DATABASE_URL

// Nothing below touches a database unless enabled: the client is only imported inside this block.
if (!enabled) test.skip('row level security (set TEST_DATABASE_URL to run)', () => {})
else describe('row level security (database)', async () => {
  process.env.DATABASE_URL = url
  const { db } = await import('../src/backend/lib/db')
  const { storeDb, systemDb } = await import('../src/backend/lib/tenancy')
  const { runNextJob } = await import('../src/backend/lib/design-import/pipeline')
  const suffix = Date.now().toString(36)
  const A = `rls_a_${suffix}`, B = `rls_b_${suffix}`

  beforeAll(async () => {
    await db.store.createMany({ data: [{ id: A, slug: A, name: 'A' }, { id: B, slug: B, name: 'B' }] })
    const row = { figmaUserId: '1', handle: 'h', authType: 'PAT' as const, accessTokenEnc: 'x.y', keyVersion: 1, createdBy: 'test' }
    await storeDb(A).figmaConnection.create({ data: { storeId: A, ...row } })
  })

  afterAll(async () => {
    for (const store of [A, B]) {
      const sdb = storeDb(store)
      await sdb.storePageVersion.deleteMany({}); await sdb.storePage.deleteMany({}); await sdb.asset.deleteMany({})
      await sdb.designImport.deleteMany({}); await sdb.figmaFile.deleteMany({}); await sdb.designSystem.deleteMany({}); await sdb.auditLog.deleteMany({})
    }
    await storeDb(A).figmaConnection.deleteMany({})
    await db.store.deleteMany({ where: { id: { in: [A, B] } } })
    await db.$disconnect()
  })

  test('a store sees only its own rows', async () => {
    expect(await storeDb(A).figmaConnection.count()).toBe(1)
    expect(await storeDb(B).figmaConnection.count()).toBe(0)
  })

  test('queries without app.store_id see nothing', async () => {
    expect(await db.figmaConnection.count({ where: { storeId: A } })).toBe(0)
  })

  test('writing another store\'s row is rejected by the policy', async () => {
    await expect(db.$transaction([
      db.$executeRaw`SELECT set_config('app.store_id', ${B}, TRUE)`,
      db.$executeRaw`INSERT INTO "FigmaConnection" ("id","storeId","figmaUserId","handle","authType","accessTokenEnc","keyVersion","createdBy","updatedAt") VALUES (${`x_${suffix}`}, ${A}, '1', 'h', 'PAT', 'x.y', 1, 'test', now())`,
    ])).rejects.toThrow()
  })

  test('every store table is isolated; the system bypass sees across stores', async () => {
    const a = storeDb(A), b = storeDb(B)
    const page = await a.storePage.create({ data: { storeId: A, type: 'HOME', slug: '', title: 'Home' } })
    await a.storePageVersion.create({ data: { storeId: A, pageId: page.id, version: 1, sections: [], createdBy: 'test' } })
    await a.asset.create({ data: { storeId: A, hash: `h_${suffix}`, storageKey: 'k', url: 'https://x/y.png', mime: 'image/png', width: 1, height: 1 } })
    await a.designSystem.create({ data: { storeId: A, version: 1, tokens: {} } })
    for (const model of ['storePage', 'storePageVersion', 'asset', 'designSystem'] as const) {
      expect(await (a[model] as any).count()).toBe(1)
      expect(await (b[model] as any).count()).toBe(0)
      expect(await (db[model] as any).count()).toBe(0) // plain client: no app.store_id → no rows
    }
    expect(await systemDb().storePage.count({ where: { storeId: A } })).toBe(1)
  })

  test('the worker claims queued jobs across stores (SKIP LOCKED) and fails them cleanly without a Figma connection', async () => {
    const file = await storeDb(B).figmaFile.create({ data: { storeId: B, fileKey: 'RlsTestFileKey0001', name: 'F', version: '1', lastModified: new Date() } })
    const job = await storeDb(B).designImport.create({ data: { storeId: B, fileId: file.id, figmaVersion: '1', selectedNodeIds: ['1:1'], pageAssignments: [], createdBy: 'test' } })
    while (await runNextJob()) { /* drain */ }
    const after = await storeDb(B).designImport.findFirst({ where: { id: job.id } })
    expect(after).toMatchObject({ status: 'FAILED', error: 'Connect a Figma account first', lockedAt: null })
  })
})
