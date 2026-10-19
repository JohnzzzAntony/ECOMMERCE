'use client'
// Store pages built from Figma imports (or from scratch): list, create, open in the page editor.
import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FilePlus2, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { slugify } from '@/shared/slug'
import { STORE_PAGE_TYPES, type StorePageType } from '@/shared/store-pages'
import { adminApi, errorMessage } from '../admin-api'
import { LoadError } from '../shared'
import { PageEditor } from './page-editor'

type PageRow = { id: string; type: StorePageType; slug: string; title: string; published: boolean; hasDraft: boolean; url: string | null; updatedAt: string }
const TYPE_LABEL: Record<StorePageType, string> = { HOME: 'Home page', PAGE: 'Content page', PRODUCT_TEMPLATE: 'Product template', COLLECTION_TEMPLATE: 'Collection template', CART: 'Cart', HEADER: 'Header (global)', FOOTER: 'Footer (global)', ANNOUNCEMENT: 'Announcement (global)' }

export function StorePagesSection() {
  const [pages, setPages] = useState<PageRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(() => (typeof window === 'undefined' ? null : new URL(window.location.href).searchParams.get('page')))
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ type: 'PAGE' as StorePageType, title: '', slug: '' })

  const load = useCallback(() => adminApi.get<PageRow[]>('/api/design/pages').then((p) => { setPages(p); setError(null) }).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    try {
      const page = await adminApi.post<PageRow>('/api/design/pages', { type: form.type, title: form.title, ...(form.type === 'PAGE' ? { slug: form.slug || slugify(form.title) } : {}) })
      setCreating(false); setForm({ type: 'PAGE', title: '', slug: '' }); setEditing(page.id)
    } catch (e) { toast.error(errorMessage(e)) }
  }

  if (editing) return <PageEditor key={editing} pageId={editing} onBack={() => { setEditing(null); load() }} pages={pages ?? []} onOpenPage={setEditing} />
  if (error) return <LoadError message={error} onRetry={load} />
  if (!pages) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div>
  const existing = new Set(pages.map((p) => p.type))

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div><CardTitle>Store pages</CardTitle><CardDescription>Pages installed from Figma designs. Changes are drafts until you publish.</CardDescription></div>
        <Button onClick={() => setCreating(true)}><FilePlus2 className="size-4" /> New page</Button>
      </CardHeader>
      <CardContent>
        {pages.length === 0 ? <p className="text-sm text-muted-foreground">No pages yet. Import a Figma design or create a page.</p> : (
          <ul className="divide-y rounded-md border">
            {pages.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1"><div className="font-medium">{p.title}</div><div className="text-xs text-muted-foreground">{TYPE_LABEL[p.type]}{p.url ? ` · ${p.url}` : ''}</div></div>
                {p.published ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Published</Badge> : <Badge variant="outline">Not published</Badge>}
                {p.hasDraft && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Unpublished changes</Badge>}
                {p.published && p.url && <Button asChild variant="ghost" size="icon" aria-label="View on store"><a href={p.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /></a></Button>}
                <Button variant="outline" size="sm" onClick={() => setEditing(p.id)}><Pencil className="size-4" /> Edit</Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent><DialogHeader><DialogTitle>New page</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Type</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as StorePageType })}>
                {STORE_PAGE_TYPES.map((t) => <option key={t} value={t} disabled={t !== 'PAGE' && existing.has(t)}>{TYPE_LABEL[t]}{t !== 'PAGE' && existing.has(t) ? ' (exists)' : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Name</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            {form.type === 'PAGE' && <div className="space-y-1"><Label>URL</Label><div className="flex items-center gap-1 text-sm text-muted-foreground">/pages/<Input value={form.slug} placeholder={slugify(form.title) || 'about-us'} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></div></div>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={create} disabled={!form.title.trim()}>Create</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
