// In-memory stand-in for the Prisma client, enough for store-scoped route and pipeline tests. It runs Prisma
// client extensions ($extends query hooks) like the real client, so storeDb()'s scoping is exercised for real.
// Models without data (catalog) answer empty results.
type Row = Record<string, any>

function matchValue(value: unknown, cond: any): boolean {
  if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    if ('in' in cond && !cond.in.includes(value)) return false
    if ('notIn' in cond && cond.notIn.includes(value)) return false
    if ('not' in cond && (cond.not === null ? value == null : value === cond.not)) return false
    if ('lt' in cond && !((value as any) < cond.lt)) return false
    if ('lte' in cond && !((value as any) <= cond.lte)) return false
    if ('gt' in cond && !((value as any) > cond.gt)) return false
    if ('gte' in cond && !((value as any) >= cond.gte)) return false
    if ('equals' in cond && value !== cond.equals) return false
    if ('contains' in cond && !String(value ?? '').toLowerCase().includes(String(cond.contains).toLowerCase())) return false
    return true
  }
  if (cond === null) return value == null
  return value instanceof Date && cond instanceof Date ? value.getTime() === cond.getTime() : value === cond
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Row[]).some((w) => matches(row, w))
    if (key === 'AND') return (cond as Row[]).every((w) => matches(row, w))
    return matchValue(row[key], cond)
  })
}

function sortRows(rows: Row[], orderBy: any) {
  const orders = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).flatMap((o: Row) => Object.entries(o))
  if (!orders.length) return rows
  return [...rows].sort((a, b) => {
    for (const [field, spec] of orders) {
      const dir = (typeof spec === 'object' ? spec.sort : spec) === 'desc' ? -1 : 1
      const av = a[field], bv = b[field]
      if (av == null && bv == null) continue
      if (av == null) return 1
      if (bv == null) return -1
      const c = av instanceof Date ? av.getTime() - bv.getTime() : typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      if (c) return c * dir
    }
    return 0
  })
}

function applyData(row: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && 'increment' in v) row[k] = (row[k] ?? 0) + v.increment
    else row[k] = v
  }
  row.updatedAt = new Date()
}

let seq = 0
// Column defaults from prisma/schema.prisma that the code relies on.
const DEFAULTS: Record<string, () => Row> = {
  storePageVersion: () => ({ revision: 0, status: 'DRAFT', publishedAt: null, sourceImportId: null }),
  storePage: () => ({ seo: {}, publishedVersionId: null, sourceFileId: null }),
  designImport: () => ({ kind: 'INSTALL', status: 'QUEUED', warnings: [], stats: {}, result: null, attempts: 0, lockedAt: null, runAfter: new Date(), error: null, installedAt: null }),
  designSystem: () => ({ status: 'DRAFT', importId: null }),
  asset: () => ({ alt: '', altReviewed: false, variants: [], blurhash: null }),
  figmaFile: () => ({ branchKey: '', webhookId: null, webhookPasscodeHash: null, latestVersion: null, lastCheckedAt: null }),
  figmaConnection: () => ({ status: 'ACTIVE', scopes: '' }),
  sectionMapping: () => ({ fieldMap: {} }),
}
const MODELS = ['user', 'store', 'storeMember', 'figmaConnection', 'figmaOAuthState', 'auditLog', 'figmaFile', 'designImport',
  'sectionMapping', 'designSystem', 'font', 'asset', 'storePage', 'storePageVersion']

export function createFakeDb() {
  const tables: Record<string, Row[]> = {}
  const rawCalls: string[] = []
  const table = (name: string) => (tables[name] ??= [])

  // include: { user } / { file } resolve the matching belongs-to relation.
  const RELATIONS: Record<string, [table: string, key: string]> = { user: ['user', 'userId'], file: ['figmaFile', 'fileId'] }
  const withIncludes = (row: Row, include?: Row) => {
    if (!row || !include) return row
    const out = { ...row }
    for (const [name, [t, key]] of Object.entries(RELATIONS)) if (include[name]) out[name] = table(t).find((r) => r.id === row[key])
    return out
  }

  const model = (name: string) => ({
    async findFirst(args: Row = {}) { return withIncludes(sortRows(table(name).filter((r) => matches(r, args.where)), args.orderBy)[0] ?? null, args.include) },
    async findUnique(args: Row) { return this.findFirst(args) },
    async findMany(args: Row = {}) {
      const rows = sortRows(table(name).filter((r) => matches(r, args.where)), args.orderBy)
      return (args.take ? rows.slice(0, args.take) : rows).map((r) => withIncludes(r, args.include))
    },
    async count(args: Row = {}) { return table(name).filter((r) => matches(r, args.where)).length },
    async create(args: Row) {
      const now = new Date()
      const row = { id: `id${(++seq).toString().padStart(10, '0')}`, createdAt: now, updatedAt: now, ...DEFAULTS[name]?.(), ...args.data }
      table(name).push(row)
      return { ...row }
    },
    async createMany(args: Row) { for (const d of args.data) await this.create({ data: d }); return { count: args.data.length } },
    async update(args: Row) {
      const row = table(name).find((r) => matches(r, args.where))
      if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' })
      applyData(row, args.data)
      return { ...row }
    },
    async updateMany(args: Row) {
      const rows = table(name).filter((r) => matches(r, args.where))
      rows.forEach((r) => applyData(r, args.data))
      return { count: rows.length }
    },
    async upsert(args: Row) {
      const row = table(name).find((r) => matches(r, args.where))
      return row ? this.update({ where: args.where, data: args.update }) : this.create({ data: args.create })
    },
    async deleteMany(args: Row = {}) {
      const before = table(name).length
      tables[name] = table(name).filter((r) => !matches(r, args.where))
      return { count: before - tables[name].length }
    },
    async groupBy() { return [] },
  })

  const base: Row = {}
  for (const name of MODELS) base[name] = model(name)
  base.$transaction = async (ops: Promise<unknown>[]) => { const out: unknown[] = []; for (const op of ops) out.push(await op); return out }
  base.$executeRaw = (strings: TemplateStringsArray, ...values: unknown[]) => {
    rawCalls.push(strings.reduce((sql, s, i) => sql + s + (i < values.length ? `'${values[i]}'` : ''), ''))
    return Promise.resolve(0)
  }
  base.$queryRaw = () => Promise.resolve([])
  base.$extends = (ext: any) => {
    const hook = ext.query?.$allModels?.$allOperations
    const out: Row = { ...base }
    for (const [name, ops] of Object.entries(base)) {
      if (name.startsWith('$')) continue
      const modelName = name[0].toUpperCase() + name.slice(1)
      out[name] = Object.fromEntries(Object.keys(ops).map((operation) => [operation, (args: Row) =>
        hook ? hook({ model: modelName, operation, args, query: (a: Row) => (ops as Row)[operation](a) }) : (ops as Row)[operation](args)]))
    }
    return out
  }
  // Catalog and other unmodelled tables: empty.
  const empty = { findFirst: async () => null, findUnique: async () => null, findMany: async () => [], count: async () => 0, groupBy: async () => [] }
  const db = new Proxy(base, { get: (target, prop: string) => (prop in target ? target[prop] : typeof prop === 'string' && !prop.startsWith('$') && prop !== 'then' ? empty : undefined) })
  const reset = () => { for (const k of Object.keys(tables)) delete tables[k]; rawCalls.length = 0 }
  return { db, tables, rawCalls, table, reset }
}
