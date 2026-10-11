// Shared plumbing for admin CRUD endpoints.
//
// `parseFields` turns an untrusted JSON body into a Prisma `data` object using an explicit
// allowlist, so admin forms can never write columns that aren't listed (ids, ratings, timestamps…).
// `adminResource` builds GET/POST/PUT/DELETE handlers for simple content tables
// (testimonials, client logos, slides, gallery, categories, brands).
import { NextResponse } from 'next/server'
import { failure, HttpError, requireAdmin, text } from './auth'
import { slugify } from './slug'
import { invalidateAll } from './memo'

export type Field =
  | { type: 'text'; required?: boolean; max?: number }
  | { type: 'number'; required?: boolean; min?: number }
  | { type: 'int'; required?: boolean; min?: number; max?: number }
  | { type: 'bool' }
  | { type: 'ref' } // optional foreign key: '' or null clears it

export type Fields = Record<string, Field>

const isBlank = (v: unknown) => v === null || v === undefined || v === ''

/** Validate `body` against `fields`. With `partial`, missing keys are left untouched (for updates). */
export function parseFields(body: Record<string, unknown>, fields: Fields, partial = false) {
  const data: Record<string, string | number | boolean | null> = {}
  for (const [key, field] of Object.entries(fields)) {
    if (!(key in body)) {
      if (!partial && 'required' in field && field.required) throw new HttpError(400, `${key} is required`)
      continue
    }
    const value = body[key]
    switch (field.type) {
      case 'bool':
        if (typeof value !== 'boolean') throw new HttpError(400, `Invalid ${key}`)
        data[key] = value
        break
      case 'number':
      case 'int': {
        if (isBlank(value)) {
          if (field.required) throw new HttpError(400, `${key} is required`)
          data[key] = null
          break
        }
        const n = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(n) || (field.type === 'int' && !Number.isInteger(n))) throw new HttpError(400, `Invalid ${key}`)
        if (field.min !== undefined && n < field.min) throw new HttpError(400, `${key} must be at least ${field.min}`)
        if (field.type === 'int' && field.max !== undefined && n > field.max) throw new HttpError(400, `${key} must be at most ${field.max}`)
        data[key] = n
        break
      }
      case 'ref':
        data[key] = isBlank(value) ? null : text(value, key, 64, true)
        break
      case 'text':
        if (isBlank(value)) {
          if (field.required) throw new HttpError(400, `${key} is required`)
          data[key] = null
        } else {
          data[key] = text(value, key, field.max ?? 500, field.required)
        }
        break
    }
  }
  return data
}

/** Slugify `source`, appending -2, -3… until no other row uses it. */
export async function uniqueSlug(source: string, taken: (slug: string) => Promise<boolean>) {
  const base = slugify(source) || 'item'
  let slug = base
  for (let i = 2; await taken(slug); i++) slug = `${base}-${i}`
  return slug
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json()
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Expected a JSON object')
  return body as Record<string, unknown>
}

export function idParam(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) throw new HttpError(400, 'id is required')
  return id
}

// Minimal view of a Prisma model delegate. Args are `any` because each model's generated
// input types differ; `parseFields` is what guarantees the data shape at runtime.
interface Delegate {
  findMany(args: any): Promise<unknown[]>
  findFirst(args: any): Promise<unknown>
  create(args: any): Promise<unknown>
  update(args: any): Promise<unknown>
  delete(args: any): Promise<unknown>
}

interface ResourceOptions {
  model: Delegate
  fields: Fields
  orderBy: object | object[]
  include?: object
  /** Generate a unique `slug` column from this field on create (and on rename if `slug` is sent). */
  slugFrom?: string
  /** Post-process the admin list (e.g. add computed fields). */
  list?: (items: any[]) => unknown[]
  /** Extra cross-field checks; throw HttpError to reject. */
  validate?: (data: Record<string, unknown>, id?: string) => void | Promise<void>
}

/** Admin-only list/create/update/delete handlers. The list includes inactive rows. */
export function adminResource({ model, fields, orderBy, include, slugFrom, validate, list }: ResourceOptions) {
  const slugTaken = (id?: string) => async (slug: string) =>
    !!(await model.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) } }))

  return {
    async GET(request: Request) {
      try {
        await requireAdmin(request)
        const items = await model.findMany({ orderBy, include })
        return NextResponse.json(list ? list(items) : items, { headers: { 'Cache-Control': 'no-store' } })
      } catch (error) { return failure(error) }
    },

    async POST(request: Request) {
      try {
        await requireAdmin(request)
        const data: Record<string, unknown> = parseFields(await readJson(request), fields)
        await validate?.(data)
        if (slugFrom) data.slug = await uniqueSlug(String(data[slugFrom]), slugTaken())
        const item = await model.create({ data, include })
        invalidateAll()
        return NextResponse.json({ ok: true, item })
      } catch (error) { return failure(error) }
    },

    async PUT(request: Request) {
      try {
        await requireAdmin(request)
        const body = await readJson(request)
        const id = text(body.id, 'id', 64, true)
        const data: Record<string, unknown> = parseFields(body, fields, true)
        await validate?.(data, id)
        if (slugFrom && typeof body.slug === 'string' && body.slug.trim()) data.slug = await uniqueSlug(body.slug, slugTaken(id))
        const item = await model.update({ where: { id }, data, include })
        invalidateAll()
        return NextResponse.json({ ok: true, item })
      } catch (error) { return failure(error) }
    },

    async DELETE(request: Request) {
      try {
        await requireAdmin(request)
        await model.delete({ where: { id: idParam(request) } })
        invalidateAll()
        return NextResponse.json({ ok: true })
      } catch (error) { return failure(error) }
    },
  }
}
