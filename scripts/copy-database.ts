// Copies every row of every table from one PostgreSQL database to another with the same schema (apply the
// migrations to the target first: bunx prisma migrate deploy). Rows already in the target are kept (ON CONFLICT
// DO NOTHING), so a copy that stopped half-way can simply be run again.
//   bun scripts/copy-database.ts <source url> <target url>
// Defaults: OLD_DATABASE_URL → DATABASE_URL from .env. Row level security is bypassed the way systemDb() does.
import { Client } from 'pg'

const [source = process.env.OLD_DATABASE_URL, target = process.env.DATABASE_URL] = process.argv.slice(2)
if (!source || !target || source === target) throw new Error('Usage: bun scripts/copy-database.ts <source url> <target url> (or OLD_DATABASE_URL and DATABASE_URL)')

const BATCH = 200
const from = new Client({ connectionString: source })
const to = new Client({ connectionString: target })
const q = (name: string) => `"${name.replace(/"/g, '""')}"`

type Fk = { child: string; parent: string; cols: string[]; nullable: boolean }

/**
 * Tables in an order that inserts referenced rows first (self-references are handled per row). A cycle between
 * tables (e.g. StorePage.publishedVersionId ↔ StorePageVersion.pageId) is broken at a nullable foreign key: those
 * columns are inserted empty and filled in after every table is copied (`deferred`).
 */
async function tablesInOrder(c: Client) {
  const tables = (await c.query<{ t: string }>(`SELECT table_name t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`)).rows.map((r) => r.t)
  const fks = (await c.query<Fk>(`
    SELECT cl.relname child, pl.relname parent, array_agg(a.attname::text) cols, bool_and(NOT a.attnotnull) nullable FROM pg_constraint k
    JOIN pg_class cl ON cl.oid = k.conrelid JOIN pg_class pl ON pl.oid = k.confrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
    WHERE k.contype = 'f' AND n.nspname = 'public' GROUP BY k.oid, cl.relname, pl.relname`)).rows.filter((f) => f.child !== f.parent)
  const order: string[] = []
  const deferred = new Map<string, string[]>()
  const waitsFor = (t: string) => fks.filter((f) => f.child === t && !order.includes(f.parent) && tables.includes(f.parent) && !deferred.get(t)?.some((col) => f.cols.includes(col)))
  while (order.length < tables.length) {
    const left = tables.filter((t) => !order.includes(t))
    const ready = left.filter((t) => !waitsFor(t).length)
    if (ready.length) { order.push(...ready.sort()); continue }
    const breakable = left.find((t) => waitsFor(t).every((f) => f.nullable))
    if (!breakable) throw new Error(`Foreign key cycle without a nullable column between: ${left.join(', ')}`)
    deferred.set(breakable, [...(deferred.get(breakable) ?? []), ...waitsFor(breakable).flatMap((f) => f.cols)])
  }
  return { order, deferred }
}

async function primaryKey(c: Client, table: string) {
  return (await c.query<{ col: string }>(`SELECT a.attname col FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey) WHERE i.indrelid = $1::regclass AND i.indisprimary`, [q(table)])).rows.map((r) => r.col)
}

const jsonCols = new Map<string, Set<string>>()
const pks = new Map<string, string[]>()

/** Upsert by primary key: the source row wins (rows the migrations created, like the default store, are replaced). */
async function insert(table: string, rows: Record<string, unknown>[]) {
  const cols = Object.keys(rows[0])
  const json = jsonCols.get(table) ?? new Set()
  const pk = pks.get(table) ?? []
  const values: unknown[] = []
  // json/jsonb values go as text; Postgres arrays (text[]) are passed as JS arrays, which pg converts.
  const tuples = rows.map((r) => `(${cols.map((col) => { const v = r[col]; values.push(json.has(col) && v !== null ? JSON.stringify(v) : v); return `$${values.length}` }).join(', ')})`)
  const rest = cols.filter((col) => !pk.includes(col))
  const onConflict = pk.length && rest.length ? `ON CONFLICT (${pk.map(q).join(', ')}) DO UPDATE SET ${rest.map((col) => `${q(col)} = EXCLUDED.${q(col)}`).join(', ')}` : 'ON CONFLICT DO NOTHING'
  return (await to.query(`INSERT INTO ${q(table)} (${cols.map(q).join(', ')}) VALUES ${tuples.join(', ')} ${onConflict}`, values)).rowCount ?? 0
}

async function main() {
  await from.connect(); await to.connect()
  for (const c of [from, to]) await c.query(`SELECT set_config('app.bypass_rls', 'on', false)`)
  const { order, deferred } = await tablesInOrder(to)
  for (const r of (await to.query<{ t: string; c: string }>(`SELECT table_name t, column_name c FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('json', 'jsonb')`)).rows) {
    if (!jsonCols.has(r.t)) jsonCols.set(r.t, new Set())
    jsonCols.get(r.t)!.add(r.c)
  }
  for (const t of order) pks.set(t, await primaryKey(to, t))
  const later: { table: string; rows: Record<string, unknown>[] }[] = []
  let total = 0
  for (const table of order) {
    const source = (await from.query(`SELECT * FROM ${q(table)}`)).rows as Record<string, unknown>[]
    const cols = deferred.get(table) ?? []
    if (cols.length) later.push({ table, rows: source })
    const rows = cols.length ? source.map((r) => ({ ...r, ...Object.fromEntries(cols.map((col) => [col, null])) })) : source
    let copied = 0
    // Rows that reference rows of the same table not inserted yet (e.g. a category's parent) wait for a later pass.
    let pending = rows
    while (pending.length) {
      const failed: Record<string, unknown>[] = []
      for (let i = 0; i < pending.length; i += BATCH) {
        const batch = pending.slice(i, i + BATCH)
        try { copied += await insert(table, batch) } catch (error) {
          if ((error as { code?: string }).code !== '23503') throw error // only foreign key misses are retried
          for (const row of batch) { try { copied += await insert(table, [row]) } catch (e) { if ((e as { code?: string }).code !== '23503') throw e; failed.push(row) } }
        }
      }
      if (failed.length === pending.length) throw new Error(`${table}: ${failed.length} rows reference rows that don't exist in the source`)
      pending = failed
    }
    const inTarget = Number((await to.query(`SELECT count(*) n FROM ${q(table)}`)).rows[0].n)
    console.log(`${table.padEnd(28)} source ${String(rows.length).padStart(6)}  copied ${String(copied).padStart(6)}  target ${String(inTarget).padStart(6)}${inTarget < rows.length ? '  ← MISSING ROWS' : ''}`)
    total += copied
  }
  // Fill in the foreign keys left empty to break cycles, now that the rows they point to exist.
  for (const { table, rows } of later) {
    const pk = pks.get(table)!, cols = deferred.get(table)!
    let filled = 0
    for (const row of rows) {
      if (cols.every((col) => row[col] === null)) continue
      const values = [...cols.map((col) => row[col]), ...pk.map((col) => row[col])]
      filled += (await to.query(`UPDATE ${q(table)} SET ${cols.map((col, i) => `${q(col)} = $${i + 1}`).join(', ')} WHERE ${pk.map((col, i) => `${q(col)} = $${cols.length + i + 1}`).join(' AND ')} `, values)).rowCount ?? 0
    }
    console.log(`${table}: filled ${filled} deferred link(s) (${cols.join(', ')})`)
  }
  console.log(`Done: ${total} rows copied into ${order.length} tables.`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 }).finally(async () => { await from.end().catch(() => {}); await to.end().catch(() => {}) })
