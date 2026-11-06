'use client'
// "Try the Look": model photos with pinned store products, shown by the homepage section of the same name.
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { Input } from '@/frontend/components/ui/input'
import { api } from '@/frontend/lib/api'
import { effectivePrice, formatAED } from '@/frontend/lib/format'
import { LOOK_MAX_PIECES, readLookPieces, type LookPiece } from '@/shared/looks'
import type { Look, Product } from '@/shared/types'
import { CrudSection, type CrudConfig } from './crud-section'
import { Thumb } from './shared'

const looks: CrudConfig<Look> = {
  endpoint: '/api/admin/looks',
  title: 'Try the Look',
  subtitle: 'Outfits for the homepage “Try the Look” section (add it under Themes → Customize)',
  singular: 'Look',
  activeToggle: true,
  searchText: (l) => l.name,
  fields: [
    { key: 'name', label: 'Look name', type: 'text', required: true, placeholder: 'e.g. The City Edit' },
    { key: 'sortOrder', label: 'Display order', type: 'number', min: 0, hint: 'Lower numbers show first.' },
    { key: 'imageUrl', label: 'Model photo', type: 'image', folder: 'looks', required: true, hint: 'A full-body photo on a transparent or plain background works best (portrait, about 9:16).' },
    {
      key: 'items', label: 'Products in this look', type: 'custom',
      render: (value, onChange, form) => <LookPiecesEditor value={value} onChange={onChange} imageUrl={String(form.imageUrl || '')} />,
    },
    { key: 'isActive', label: 'Visible on website', type: 'switch' },
  ],
  columns: [
    { label: 'Photo', className: 'w-16', render: (l) => <Thumb src={l.imageUrl} alt={l.name} className="h-14 w-10 object-contain" /> },
    { label: 'Look', render: (l) => <span className="font-medium text-brand-ink">{l.name}</span> },
    { label: 'Products', render: (l) => readLookPieces(l.items).length },
    { label: 'Order', className: 'text-right', render: (l) => l.sortOrder },
  ],
}

export const LooksSection = () => <CrudSection config={looks} />

function LookPiecesEditor({ value, onChange, imageUrl }: { value: string; onChange: (v: string) => void; imageUrl: string }) {
  const pieces = useMemo(() => readLookPieces(value), [value])
  const [products, setProducts] = useState<Record<string, Product>>({})
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const save = (next: LookPiece[]) => onChange(JSON.stringify(next))

  // Names and photos for pieces already in the look.
  const ids = pieces.map((p) => p.productId).join(',')
  const requested = useRef(new Set<string>())
  useEffect(() => {
    const missing = ids.split(',').filter((id) => id && !requested.current.has(id))
    if (!missing.length) return
    missing.forEach((id) => requested.current.add(id))
    api.productsByIds(missing).then((list) => setProducts((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.id, p])) }))).catch(() => {})
  }, [ids])

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const t = setTimeout(() => {
      api.products({ search: q, page_size: '8' }).then((r) => setResults(r.products)).catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const add = (p: Product) => {
    if (pieces.some((x) => x.productId === p.id) || pieces.length >= LOOK_MAX_PIECES) return
    requested.current.add(p.id)
    setProducts((prev) => ({ ...prev, [p.id]: p }))
    save([...pieces, { productId: p.id, x: 50, y: Math.min(90, 25 + pieces.length * 25) }])
    setActive(pieces.length)
    setQuery('')
  }
  const remove = (i: number) => { save(pieces.filter((_, j) => j !== i)); setActive(0) }
  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pieces[active]) return
    const r = e.currentTarget.getBoundingClientRect()
    const round = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10
    save(pieces.map((p, i) => (i === active ? { ...p, x: round(((e.clientX - r.left) / r.width) * 100), y: round(((e.clientY - r.top) / r.height) * 100) } : p)))
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
      <div>
        {imageUrl ? (
          <div className="relative cursor-crosshair select-none overflow-hidden rounded-lg border border-border bg-muted/40" onClick={place}
            role="presentation" title={pieces[active] ? 'Click to move the selected pin' : undefined}>
            <img src={imageUrl} alt="" className="block w-full" draggable={false} />
            {pieces.map((p, i) => (
              <span key={p.productId} style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className={`pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-semibold shadow ${i === active ? 'bg-brand-teal text-white ring-2 ring-white' : 'bg-white text-brand-ink'}`}>
                {i + 1}
              </span>
            ))}
          </div>
        ) : <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">Upload the model photo to place pins on it.</p>}
        {imageUrl && pieces.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Select a product, then click the photo where its pin should go.</p>}
      </div>

      <div className="space-y-3">
        <ul className="space-y-2">
          {pieces.map((p, i) => {
            const product = products[p.productId]
            return (
              <li key={p.productId}>
                <div className={`flex items-center gap-3 rounded-lg border p-2 ${i === active ? 'border-brand-teal bg-brand-teal/5' : 'border-border'}`}>
                  <button type="button" onClick={() => setActive(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-pressed={i === active}>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-ink text-[11px] font-semibold text-white">{i + 1}</span>
                    <Thumb src={product?.images?.[0]?.imageUrl} alt={product?.name ?? 'Product'} className="size-10" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{product?.name ?? 'Loading…'}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {p.x}% · {p.y}%</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => remove(i)} className="rounded p-1 text-muted-foreground hover:text-red-500" aria-label={`Remove ${product?.name ?? 'product'}`}><X className="size-4" /></button>
                </div>
              </li>
            )
          })}
        </ul>

        {pieces.length < LOOK_MAX_PIECES ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products to add…" className="pl-9" aria-label="Search products to add" />
            {query.trim() && results.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                {results.map((p) => {
                  const taken = pieces.some((x) => x.productId === p.id)
                  return (
                    <li key={p.id}>
                      <button type="button" disabled={taken} onClick={() => add(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50">
                        <Thumb src={p.images?.[0]?.imageUrl} alt={p.name} className="size-8" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{taken ? 'Added' : formatAED(effectivePrice(p))}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : <p className="text-xs text-muted-foreground">A look holds up to {LOOK_MAX_PIECES} products.</p>}
      </div>
    </div>
  )
}
