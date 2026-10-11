// Admin CRUD for custom pages. Pages are placed on the storefront through menus (link `page:<slug>`)
// or the homepage "Custom page" section, and are reachable at /?page=<slug>.
import { db } from '@/backend/lib/db'
import { adminResource } from '@/backend/lib/admin-resource'
import { HttpError } from '@/backend/lib/auth'

export const pages = adminResource({
  model: db.page,
  orderBy: [{ themeId: 'asc' }, { title: 'asc' }],
  include: { theme: { select: { id: true, name: true } } },
  slugFrom: 'title',
  fields: {
    title: { type: 'text', required: true, max: 200 },
    content: { type: 'text', max: 2_000_000 },
    css: { type: 'text', max: 1_000_000 },
    bodyClass: { type: 'text', max: 500 },
    layout: { type: 'text', max: 20 },
    hideHeaderFooter: { type: 'bool' },
    isPublished: { type: 'bool' },
    metaTitle: { type: 'text', max: 200 },
    metaDescription: { type: 'text', max: 500 },
  },
  validate: (data) => {
    if ('layout' in data && data.layout !== 'standard' && data.layout !== 'isolated') throw new HttpError(400, 'layout must be standard or isolated')
    // Text columns are non-nullable here; parseFields turns '' into null.
    for (const key of ['content', 'css', 'bodyClass'] as const) if (key in data && data[key] === null) data[key] = ''
  },
})
