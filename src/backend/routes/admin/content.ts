// Admin CRUD for homepage/marketing content. Public read-only lists live in routes/content/*.
import { db } from '@/backend/lib/db'
import { adminResource } from '@/backend/lib/admin-resource'

const display = { sortOrder: { type: 'int', min: 0, max: 100000 }, isActive: { type: 'bool' } } as const

export const testimonials = adminResource({
  model: db.testimonial,
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  fields: {
    name: { type: 'text', required: true, max: 120 },
    role: { type: 'text', max: 160 },
    avatarUrl: { type: 'text', max: 1000 },
    content: { type: 'text', required: true, max: 2000 },
    rating: { type: 'int', min: 1, max: 5 },
    ...display,
  },
})

export const clients = adminResource({
  model: db.clientLogo,
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  fields: {
    name: { type: 'text', required: true, max: 120 },
    logoUrl: { type: 'text', max: 1000 },
    websiteUrl: { type: 'text', max: 500 },
    ...display,
  },
})

export const slides = adminResource({
  model: db.heroSlide,
  orderBy: { sortOrder: 'asc' },
  fields: {
    imageUrl: { type: 'text', required: true, max: 1000 },
    title: { type: 'text', max: 160 },
    subtitle: { type: 'text', max: 300 },
    ctaLabel: { type: 'text', max: 60 },
    ctaUrl: { type: 'text', max: 500 },
    ...display,
  },
})

export const gallery = adminResource({
  model: db.galleryItem,
  orderBy: { sortOrder: 'asc' },
  fields: {
    imageUrl: { type: 'text', required: true, max: 1000 },
    caption: { type: 'text', max: 300 },
    category: { type: 'text', max: 60 },
    ...display,
  },
})
