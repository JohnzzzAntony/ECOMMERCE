'use client'
// Homepage content: media (gallery + hero slides), testimonials and client logos.
import { useState } from 'react'
import { Image as ImageIcon, Sparkles, Star } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import type { ClientLogo, GalleryItem, HeroSlide, Testimonial } from '@/shared/types'
import { CrudSection, type CrudConfig } from './crud-section'
import { initials, Thumb } from './shared'

const order = { key: 'sortOrder', label: 'Display order', type: 'number', min: 0, hint: 'Lower numbers show first.' } as const
const visible = { key: 'isActive', label: 'Visible on website', type: 'switch' } as const

const gallery: CrudConfig<GalleryItem> = {
  endpoint: '/api/admin/gallery',
  title: 'Gallery',
  singular: 'Image',
  activeToggle: true,
  searchText: (g) => `${g.caption} ${g.category}`,
  fields: [
    { key: 'imageUrl', label: 'Image', type: 'image', folder: 'gallery', required: true },
    { key: 'caption', label: 'Caption', type: 'text', placeholder: 'e.g. Dubai showroom entrance' },
    { key: 'category', label: 'Category', type: 'text', placeholder: 'Showroom, Events, Team…' },
    order,
    visible,
  ],
  columns: [
    { label: 'Image', className: 'w-20', render: (g) => <Thumb src={g.imageUrl} alt={g.caption || 'Gallery image'} className="size-14" /> },
    { label: 'Caption', render: (g) => <span className="font-medium text-brand-ink">{g.caption || 'Untitled'}</span> },
    { label: 'Category', render: (g) => g.category },
    { label: 'Order', className: 'text-right', render: (g) => g.sortOrder },
  ],
}

const slides: CrudConfig<HeroSlide> = {
  endpoint: '/api/admin/slides',
  title: 'Hero Slides',
  subtitle: 'Homepage banner carousel',
  singular: 'Slide',
  activeToggle: true,
  fields: [
    { key: 'imageUrl', label: 'Slide image', type: 'image', folder: 'slides', required: true },
    { key: 'title', label: 'Title', type: 'text', placeholder: 'e.g. Next-Gen ICU Beds' },
    { key: 'subtitle', label: 'Subtitle', type: 'text', placeholder: 'e.g. Premium hospital equipment' },
    { key: 'ctaLabel', label: 'Button label', type: 'text', placeholder: 'e.g. Shop Now' },
    { key: 'ctaUrl', label: 'Button link', type: 'text', placeholder: 'e.g. products or /products', hint: 'A page name (products, offers, contact) or a full URL.' },
    order,
    visible,
  ],
  columns: [
    { label: 'Image', className: 'w-24', render: (s) => <Thumb src={s.imageUrl} alt={s.title || 'Slide'} className="h-12 w-20" /> },
    {
      label: 'Slide', render: (s) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{s.title || 'Untitled slide'}</div>
          <div className="truncate text-xs text-muted-foreground">{s.subtitle || '—'}</div>
        </div>
      ),
    },
    { label: 'Button', render: (s) => <span className="text-xs text-muted-foreground">{s.ctaLabel ? `${s.ctaLabel} → ${s.ctaUrl || '—'}` : '—'}</span> },
    { label: 'Order', className: 'text-right', render: (s) => s.sortOrder },
  ],
}

const testimonials: CrudConfig<Testimonial> = {
  endpoint: '/api/admin/testimonials',
  title: 'Testimonials',
  subtitle: 'Customer quotes shown on the homepage',
  singular: 'Testimonial',
  activeToggle: true,
  searchText: (t) => `${t.name} ${t.role} ${t.content}`,
  fields: [
    { key: 'name', label: 'Customer name', type: 'text', required: true },
    { key: 'role', label: 'Role / company', type: 'text', placeholder: 'e.g. Procurement Manager, Mediclinic' },
    { key: 'content', label: 'Quote', type: 'textarea', required: true },
    { key: 'rating', label: 'Rating', type: 'rating' },
    order,
    { key: 'avatarUrl', label: 'Photo (optional)', type: 'image', folder: 'testimonials' },
    visible,
  ],
  columns: [
    {
      label: 'Customer', render: (t) => (
        <div className="flex items-center gap-3">
          {t.avatarUrl
            ? <img src={t.avatarUrl} alt={t.name} className="size-9 rounded-full object-cover" />
            : <div className="flex size-9 items-center justify-center rounded-full bg-brand-gold/20 text-xs font-bold text-brand-gold">{initials(t.name)}</div>}
          <div>
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.role || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      label: 'Rating', render: (t) => (
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`size-3.5 ${i < t.rating ? 'fill-brand-gold text-brand-gold' : 'text-muted'}`} />)}
        </div>
      ),
    },
    { label: 'Quote', className: 'max-w-sm', render: (t) => <p className="line-clamp-2 text-sm text-muted-foreground">{t.content}</p> },
  ],
}

const clients: CrudConfig<ClientLogo> = {
  endpoint: '/api/admin/clients',
  title: 'Clients & Partners',
  subtitle: 'Logos shown in the “trusted by” strip',
  singular: 'Client',
  activeToggle: true,
  searchText: (c) => `${c.name} ${c.websiteUrl}`,
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'websiteUrl', label: 'Website', type: 'text', placeholder: 'https://…' },
    { key: 'logoUrl', label: 'Logo', type: 'image', folder: 'clients' },
    order,
    visible,
  ],
  columns: [
    { label: 'Logo', className: 'w-24', render: (c) => c.logoUrl ? <img src={c.logoUrl} alt={c.name} className="h-10 w-20 object-contain" /> : <Thumb alt={c.name} className="h-10 w-20" /> },
    { label: 'Name', render: (c) => <span className="font-medium text-brand-ink">{c.name}</span> },
    {
      label: 'Website', render: (c) => c.websiteUrl
        ? <a href={c.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-teal hover:underline">{c.websiteUrl.replace(/^https?:\/\//, '')}</a>
        : '—',
    },
    { label: 'Order', className: 'text-right', render: (c) => c.sortOrder },
  ],
}

export function MediaSection() {
  const [tab, setTab] = useState('slides')
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="slides" className="gap-1.5"><Sparkles className="size-4" /> Hero Slides</TabsTrigger>
        <TabsTrigger value="gallery" className="gap-1.5"><ImageIcon className="size-4" /> Gallery</TabsTrigger>
      </TabsList>
      <TabsContent value="slides"><CrudSection config={slides} /></TabsContent>
      <TabsContent value="gallery"><CrudSection config={gallery} /></TabsContent>
    </Tabs>
  )
}

export const TestimonialsSection = () => <CrudSection config={testimonials} />
export const ClientsSection = () => <CrudSection config={clients} />
