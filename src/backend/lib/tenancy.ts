// Store-scoped database access and per-store roles.
//
// storeDb(storeId) is the only way to touch store-owned tables (STORE_MODELS): it adds storeId to every
// query's filter/data and, in the same transaction, sets app.store_id so the Postgres row level security
// policies (migration 2_figma_connection) admit only that store's rows. Either layer alone blocks
// cross-store access; together a missed filter or a raw query still can't leak another store's data.
import type { StoreRole } from '@prisma/client'
import { db } from '@/backend/lib/db'
import { HttpError, requireUser } from '@/backend/lib/auth'
import { currentStore } from '@/backend/lib/store'

export const STORE_MODELS = new Set([
  'StoreMember', 'FigmaConnection', 'FigmaOAuthState', 'AuditLog', 'FigmaFile', 'DesignImport',
  'SectionMapping', 'DesignSystem', 'Font', 'Asset', 'StorePage', 'StorePageVersion',
])

const WHERE_OPS = new Set([
  'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'update', 'updateMany', 'delete', 'deleteMany',
])

type Args = Record<string, any>

/** Adds the store filter to a query's arguments. Exported for tests. */
export function scopeArgs(operation: string, args: Args | undefined, storeId: string): Args {
  const a: Args = { ...(args ?? {}) }
  if (WHERE_OPS.has(operation) || operation === 'upsert') a.where = { ...(a.where ?? {}), storeId }
  if (operation === 'create') a.data = { ...a.data, storeId }
  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((row: Args) => ({ ...row, storeId }))
  }
  if (operation === 'upsert') a.create = { ...a.create, storeId }
  // A row can never be moved to another store.
  if (operation === 'update' || operation === 'updateMany' || operation === 'upsert') {
    const data = operation === 'upsert' ? 'update' : 'data'
    if (a[data] && 'storeId' in a[data]) { const { storeId: _drop, ...rest } = a[data]; a[data] = rest }
  }
  return a
}

export function storeDb(storeId: string) {
  return db.$extends({
    name: 'store-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!STORE_MODELS.has(model)) return query(args)
          const [, result] = await db.$transaction([
            db.$executeRaw`SELECT set_config('app.store_id', ${storeId}, TRUE)`,
            query(scopeArgs(operation, args, storeId)),
          ])
          return result
        },
      },
    },
  })
}

export type StoreDb = ReturnType<typeof storeDb>

/**
 * Cross-store access for the background worker and webhook lookups only: sets app.bypass_rls for the query.
 * Never use it in request handlers that act for a store; use storeDb(store.id).
 */
export function systemDb() {
  return db.$extends({
    name: 'system-scope',
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          if (!STORE_MODELS.has(model)) return query(args)
          const [, result] = await db.$transaction([db.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`, query(args)])
          return result
        },
      },
    },
  })
}

const RANK: Record<StoreRole, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 }

export function hasRole(role: StoreRole, min: StoreRole) {
  return RANK[role] >= RANK[min]
}

/** Signed-in user with at least `min` role in the request's store (CSRF-checked for mutations). */
export async function requireStoreRole(request: Request, min: StoreRole) {
  const user = await requireUser(request)
  const store = await currentStore(request)
  const sdb = storeDb(store.id)
  const member = await sdb.storeMember.findFirst({ where: { userId: user.id } })
  if (!member || !hasRole(member.role, min)) throw new HttpError(403, 'You do not have permission for this store')
  return { user, store, role: member.role, db: sdb }
}

export function clientIp(request: Request) {
  return request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
}

/** Records a sensitive action. Pass the request for user actions (its IP is stored); background actions pass null. */
export async function audit(ctx: { db: StoreDb; store: { id: string } }, request: Request | null, entry: { actorId: string | null; action: string; entityType: string; entityId?: string | null; diff?: object }) {
  await ctx.db.auditLog.create({
    data: { storeId: ctx.store.id, actorId: entry.actorId, action: entry.action, entityType: entry.entityType, entityId: entry.entityId ?? null, diff: entry.diff ?? {}, ip: request ? clientIp(request) : null },
  })
}
