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
  const suffix = Date.now().toString(36)
  const A = `rls_a_${suffix}`, B = `rls_b_${suffix}`

  beforeAll(async () => {
    await db.store.createMany({ data: [{ id: A, slug: A, name: 'A' }, { id: B, slug: B, name: 'B' }] })
    await storeDb(A).auditLog.create({ data: { storeId: A, action: 'test', entityType: 'Store' } })
  })

  afterAll(async () => {
    for (const store of [A, B]) {
      const sdb = storeDb(store)
      await sdb.storePageVersion.deleteMany({}); await sdb.storePage.deleteMany({}); await sdb.asset.deleteMany({})
      await sdb.designSystem.deleteMany({}); await sdb.auditLog.deleteMany({})
    }
    await db.store.deleteMany({ where: { id: { in: [A, B] } } })
    await db.$disconnect()
  })

  test('a store sees only its own rows', async () => {
    expect(await storeDb(A).auditLog.count()).toBe(1)
    expect(await storeDb(B).auditLog.count()).toBe(0)
  })

  test('queries without app.store_id see nothing', async () => {
    expect(await db.auditLog.count({ where: { storeId: A } })).toBe(0)
  })

  test('writing another store\'s row is rejected by the policy', async () => {
    await expect(db.$transaction([
      db.$executeRaw`SELECT set_config('app.store_id', ${B}, TRUE)`,
      db.$executeRaw`INSERT INTO "AuditLog" ("id","storeId","action","entityType") VALUES (${`x_${suffix}`}, ${A}, 'test', 'Store')`,
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

})
