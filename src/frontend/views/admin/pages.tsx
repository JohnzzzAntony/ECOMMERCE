'use client'
// Custom pages: create/edit HTML pages and place them on the storefront (menus or homepage section).
import { useMemo, useState } from 'react'
import { ExternalLink, Eye, FileText, ImagePlus, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent } from '@/frontend/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Switch } from '@/frontend/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/frontend/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { Textarea } from '@/frontend/components/ui/textarea'
import { IsolatedFrame, SafeHtml } from '@/frontend/components/theme/html-content'
import type { MenuHandle, MenuItem } from '@/shared/theme'
import { adminApi, errorMessage, useAdminList } from './admin-api'
import { refreshStorefrontTheme } from './navigation'
import { VisualEditor } from './visual-editor'
import { LoadError, SectionHeader, StatusBadge } from './shared'

export interface AdminPage {
  id: string
  slug: string
  title: string
  content: string
  css: string
  bodyClass: string
  layout: 'standard' | 'isolated'
  hideHeaderFooter: boolean
  isPublished: boolean
  metaTitle: string | null
  metaDescription: string | null
  updatedAt: string
  theme: { id: string; name: string } | null
}

export type Draft = Omit<AdminPage, 'id' | 'updatedAt' | 'theme'> & { id?: string; theme?: AdminPage['theme'] }

const BLANK: Draft = {
  slug: '', title: '', content: '<h2>Heading</h2>\n<p>Write your content here.</p>', css: '', bodyClass: '',
  layout: 'standard', hideHeaderFooter: false, isPublished: true, metaTitle: '', metaDescription: '',
}

async function addToMenu(handle: MenuHandle, page: { slug: string; title: string }) {
  const menus = await adminApi.get<Record<MenuHandle, MenuItem[]>>('/api/admin/menus')
  const item: MenuItem = { id: `m-${Date.now().toString(36)}`, label: page.title, link: `page:${page.slug}` }
  let items = menus[handle]
  // Footer links live inside columns; add to the last column when there is one.
  const column = handle === 'footer' ? [...items].reverse().find((i) => i.children) : undefined
  items = column ? items.map((i) => (i === column ? { ...i, children: [...(i.children ?? []), item] } : i)) : [...items, item]
  await adminApi.put('/api/admin/menus', { handle, items })
  refreshStorefrontTheme()
}

function PageEditor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [uploading, setUploading] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value })

  const insertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    form.append('folder', 'pages')
    setUploading(true)
    try {
      const { url } = await adminApi.post<{ url: string }>('/api/admin/upload', form)
      set('content', `${draft.content}\n<img src="${url}" alt="" />`)
      toast.success('Image added at the end of the content')
    } catch (err) { toast.error(errorMessage(err)) } finally { setUploading(false) }
  }

  return (
    <Tabs defaultValue={draft.id ? 'visual' : 'content'}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="visual"><Pencil className="size-3.5" /> Visual editor</TabsTrigger>
        <TabsTrigger value="content">Content & code</TabsTrigger>
        <TabsTrigger value="preview"><Eye className="size-3.5" /> Preview</TabsTrigger>
        <TabsTrigger value="design">Layout & CSS</TabsTrigger>
        <TabsTrigger value="seo">SEO</TabsTrigger>
      </TabsList>

      <TabsContent value="visual">
        <VisualEditor
          html={draft.content} css={draft.css} bodyClass={draft.bodyClass}
          themeCssUrl={draft.layout === 'isolated' && draft.theme ? `/api/theme-css/${draft.theme.id}` : ''}
          onChange={(content) => set('content', content)}
        />
      </TabsContent>

      <TabsContent value="content" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label>Title</Label><Input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="About us" /></div>
          <div className="grid gap-1.5">
            <Label>URL slug</Label>
            <Input value={draft.slug} onChange={(e) => set('slug', e.target.value)} placeholder={draft.id ? '' : 'Generated from the title'} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Content (HTML)</Label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-brand-teal hover:underline">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />} Insert image
              <input type="file" accept="image/*" className="sr-only" onChange={insertImage} disabled={uploading} />
            </label>
          </div>
          <Textarea value={draft.content} onChange={(e) => set('content', e.target.value)} rows={18} className="font-mono text-xs" spellCheck={false} />
          <p className="text-xs text-muted-foreground">
            Standard pages are sanitized: scripts and forms are removed. Link to other pages with <code>/?page=slug</code>.
          </p>
        </div>
        <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <span className="text-sm font-medium">Published</span>
          <Switch checked={draft.isPublished} onCheckedChange={(v) => set('isPublished', v)} />
        </label>
      </TabsContent>

      <TabsContent value="preview" className="space-y-2">
        {draft.layout === 'standard' && draft.css && <p className="text-xs text-muted-foreground">Page CSS is applied on the storefront only.</p>}
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background">
          {draft.layout === 'isolated'
            ? <IsolatedFrame title="Preview" html={draft.content} css={draft.css} bodyClass={draft.bodyClass} themeCssUrl={draft.theme ? `/api/theme-css/${draft.theme.id}` : ''} />
            : <div className="p-6"><SafeHtml html={draft.content} /></div>}
        </div>
      </TabsContent>

      <TabsContent value="design" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Layout</Label>
            <Select value={draft.layout} onValueChange={(v) => set('layout', v as Draft['layout'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard — uses the store theme</SelectItem>
                <SelectItem value="isolated">Isolated — own styles only (imported templates)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between self-end rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium">Hide store header & footer</span>
            <Switch checked={draft.hideHeaderFooter} onCheckedChange={(v) => set('hideHeaderFooter', v)} />
          </label>
        </div>
        <div className="grid gap-1.5">
          <Label>Page CSS</Label>
          <Textarea value={draft.css} onChange={(e) => set('css', e.target.value)} rows={10} className="font-mono text-xs" spellCheck={false} placeholder=".hero { padding: 4rem 0; }" />
          <p className="text-xs text-muted-foreground">Standard layout: applies to the whole store while this page is open. Isolated layout: applies inside the page only.</p>
        </div>
        {draft.layout === 'isolated' && (
          <div className="grid gap-1.5"><Label>Body class</Label><Input value={draft.bodyClass} onChange={(e) => set('bodyClass', e.target.value)} /></div>
        )}
      </TabsContent>

      <TabsContent value="seo" className="space-y-4">
        <div className="grid gap-1.5"><Label>Meta title</Label><Input value={draft.metaTitle ?? ''} onChange={(e) => set('metaTitle', e.target.value)} placeholder={draft.title} /></div>
        <div className="grid gap-1.5"><Label>Meta description</Label><Textarea value={draft.metaDescription ?? ''} onChange={(e) => set('metaDescription', e.target.value)} rows={3} /></div>
      </TabsContent>
    </Tabs>
  )
}

/** Edit/create dialog, shared by Pages and the theme editor. */
export function PageDialog({ draft, setDraft, onSaved }: { draft: Draft | null; setDraft: (d: Draft | null) => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!draft) return
    if (!draft.title.trim()) return toast.error('Title is required')
    setSaving(true)
    try {
      const { id, slug, theme: _theme, ...fields } = draft
      const body = { ...fields, ...(slug.trim() ? { slug } : {}) }
      if (id) await adminApi.put('/api/admin/pages', { id, ...body })
      else await adminApi.post('/api/admin/pages', body)
      toast.success('Page saved')
      setDraft(null)
      onSaved()
      refreshStorefrontTheme()
    } catch (e) { toast.error(errorMessage(e)) } finally { setSaving(false) }
  }
  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
      <DialogContent className="max-h-[96vh] overflow-y-auto sm:max-w-[min(96vw,1400px)]">
        <DialogHeader>
          <DialogTitle>{draft?.id ? `Edit “${draft.title}”` : 'New page'}</DialogTitle>
          <DialogDescription>Changes are saved to the live website.</DialogDescription>
        </DialogHeader>
        {draft && <PageEditor draft={draft} setDraft={setDraft} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
          <Button className="bg-brand-teal hover:bg-brand-teal-dark" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save page'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Page → editable draft. */
export const pageDraft = (p: AdminPage): Draft => ({ ...p, metaTitle: p.metaTitle ?? '', metaDescription: p.metaDescription ?? '' })

export function PagesSection() {
  const { items, loading, error, reload } = useAdminList<AdminPage>('/api/admin/pages')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((p) => `${p.title} ${p.slug}`.toLowerCase().includes(q)) : items
  }, [items, query])

  const remove = async (page: AdminPage) => {
    if (!confirm(`Delete "${page.title}"? Menu links to it will stop working.`)) return
    try {
      await adminApi.del(`/api/admin/pages?id=${page.id}`)
      toast.success('Page deleted')
      reload()
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const place = async (handle: MenuHandle, page: AdminPage) => {
    try {
      await addToMenu(handle, page)
      toast.success(`Added to the ${handle === 'main' ? 'header' : 'footer'} menu`)
    } catch (e) { toast.error(errorMessage(e)) }
  }

  if (error) return <LoadError message={error} onRetry={reload} />

  return (
    <div className="space-y-5">
      <SectionHeader title="Pages" subtitle="Custom pages. Place them in a menu, or on the homepage with a “Custom page” section in Themes → Customize.">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages" className="w-56 pl-8" />
        </div>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => setDraft({ ...BLANK })}><Plus className="size-4" /> Add page</Button>
      </SectionHeader>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{items.length ? 'No pages match your search.' : 'No custom pages yet.'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-brand-ink">{p.title}</div>
                      <div className="text-xs text-muted-foreground">/?page={p.slug}{p.layout === 'isolated' && <Badge variant="outline" className="ml-2 h-4 px-1 text-[9px]">isolated</Badge>}</div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{p.theme ? `Theme: ${p.theme.name}` : 'Custom'}</TableCell>
                    <TableCell><StatusBadge status={p.isPublished ? 'published' : 'draft'} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Select value="" onValueChange={(h) => place(h as MenuHandle, p)}>
                          <SelectTrigger size="sm" className="h-8 w-auto text-xs"><SelectValue placeholder="Add to menu" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main">Header menu</SelectItem>
                            <SelectItem value="footer">Footer menu</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" asChild aria-label="View"><a href={`/?page=${p.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a></Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setDraft(pageDraft(p))}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" className="text-red-600 hover:text-red-700" onClick={() => remove(p)}><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PageDialog draft={draft} setDraft={setDraft} onSaved={reload} />
    </div>
  )
}
