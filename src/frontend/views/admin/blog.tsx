'use client'
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
import { Textarea } from '@/frontend/components/ui/textarea'
import { formatDate } from '@/frontend/lib/format'
import type { BlogPost } from '@/shared/types'
import { adminApi, errorMessage, useAdminList } from './admin-api'
import { ImageUpload, LoadError, SectionHeader, StatusBadge, Thumb } from './shared'

type Post = BlogPost & { metaTitle?: string | null; metaDescription?: string | null }
const ALL = 'all'

export function BlogSection() {
  const { items, setItems, loading, error, reload } = useAdminList<Post>('/api/admin/blog')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(ALL)
  const [editing, setEditing] = useState<Post | 'new' | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((p) => (status === ALL || (status === 'published') === p.isPublished)
      && (!q || `${p.title} ${p.category} ${p.authorName} ${p.tags ?? ''}`.toLowerCase().includes(q)))
  }, [items, query, status])
  const drafts = items.filter((p) => !p.isPublished).length

  const togglePublished = async (p: Post, isPublished: boolean) => {
    try {
      const { post } = await adminApi.put<{ post: Post }>('/api/admin/blog', { id: p.id, isPublished })
      setItems((prev) => prev.map((x) => (x.id === post.id ? post : x)))
      toast.success(isPublished ? 'Post published' : 'Post moved to drafts')
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const remove = async (p: Post) => {
    if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return
    try {
      await adminApi.del(`/api/admin/blog?id=${encodeURIComponent(p.id)}`)
      setItems((prev) => prev.filter((x) => x.id !== p.id))
      toast.success('Post deleted')
    } catch (e) { toast.error(errorMessage(e)) }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Blog" subtitle={`${items.length - drafts} published · ${drafts} draft${drafts === 1 ? '' : 's'}`}>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => setEditing('new')}><Plus className="size-4" /> New Post</Button>
      </SectionHeader>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search title, category, tags…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All posts</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? <LoadError message={error} onRetry={reload} /> : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Cover</TableHead><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Author</TableHead>
                  <TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Published</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-14 w-full" /></TableCell></TableRow>)
                ) : visible.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">{items.length ? 'No matches.' : 'No blog posts yet.'}</TableCell></TableRow>
                ) : visible.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Thumb src={p.coverImageUrl} alt={p.title} className="size-12" /></TableCell>
                    <TableCell>
                      <div className="line-clamp-2 max-w-sm font-medium text-brand-ink">{p.title}</div>
                      <div className="line-clamp-1 max-w-sm text-xs text-muted-foreground">{p.excerpt}</div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                    <TableCell className="text-sm">{p.authorName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(p.publishedAt)}</TableCell>
                    <TableCell><StatusBadge status={p.isPublished ? 'published' : 'draft'} /></TableCell>
                    <TableCell className="text-center"><Switch checked={p.isPublished} onCheckedChange={(v) => togglePublished(p, v)} aria-label="Published" /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(p)} aria-label="Edit"><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => remove(p)} aria-label="Delete"><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PostDialog
        post={editing}
        categories={[...new Set(items.map((p) => p.category))]}
        onClose={() => setEditing(null)}
        onSaved={(post, created) => {
          setItems((prev) => (created ? [post, ...prev] : prev.map((x) => (x.id === post.id ? post : x))))
          setEditing(null)
        }}
      />
    </div>
  )
}

const blank = {
  title: '', excerpt: '', content: '', category: 'General', tags: '', authorName: 'Store Editorial',
  coverImageUrl: '', isPublished: true, metaTitle: '', metaDescription: '',
}

function PostDialog({ post, categories, onClose, onSaved }: {
  post: Post | 'new' | null
  categories: string[]
  onClose: () => void
  onSaved: (p: Post, created: boolean) => void
}) {
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const isNew = post === 'new'

  useEffect(() => {
    if (!post) return
    setForm(post === 'new' ? blank : {
      title: post.title, excerpt: post.excerpt || '', content: post.content, category: post.category, tags: post.tags || '',
      authorName: post.authorName, coverImageUrl: post.coverImageUrl || '', isPublished: post.isPublished,
      metaTitle: post.metaTitle || '', metaDescription: post.metaDescription || '',
    })
  }, [post])

  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required'); return }
    setSaving(true)
    try {
      const res = isNew
        ? await adminApi.post<{ post: Post }>('/api/admin/blog', form)
        : await adminApi.put<{ post: Post }>('/api/admin/blog', { id: (post as Post).id, ...form })
      toast.success(isNew ? (form.isPublished ? 'Post published' : 'Draft saved') : 'Post updated')
      onSaved(res.post, isNew)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!post} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New Blog Post' : 'Edit Blog Post'}</DialogTitle>
          <DialogDescription>Content supports Markdown: ## headings, **bold**, lists, links.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2"><Label>Title <span className="text-red-500">*</span></Label><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
          <div className="sm:col-span-2"><ImageUpload value={form.coverImageUrl} onChange={(url) => set('coverImageUrl', url)} folder="blog" label="Cover image" /></div>
          <div className="grid gap-2">
            <Label>Category</Label>
            <Input list="blog-categories" value={form.category} onChange={(e) => set('category', e.target.value)} />
            <datalist id="blog-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="grid gap-2"><Label>Author</Label><Input value={form.authorName} onChange={(e) => set('authorName', e.target.value)} /></div>
          <div className="grid gap-2 sm:col-span-2"><Label>Excerpt</Label><Textarea value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} rows={2} placeholder="Short summary shown on the blog list" /></div>
          <div className="grid gap-2 sm:col-span-2"><Label>Content <span className="text-red-500">*</span></Label><Textarea value={form.content} onChange={(e) => set('content', e.target.value)} rows={12} className="font-mono text-sm" /></div>
          <div className="grid gap-2 sm:col-span-2"><Label>Tags</Label><Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Comma separated, e.g. wheelchairs, mobility" /></div>
          <div className="grid gap-2"><Label>SEO title</Label><Input value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder="Defaults to the title" /></div>
          <div className="grid gap-2"><Label>SEO description</Label><Input value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} placeholder="Defaults to the excerpt" /></div>
          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2">
            <span>Published <span className="text-muted-foreground">(off = draft, hidden from the website)</span></span>
            <Switch checked={form.isPublished} onCheckedChange={(v) => set('isPublished', v)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : isNew ? (form.isPublished ? 'Publish Post' : 'Save Draft') : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
