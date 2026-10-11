'use client'
// Config-driven list + create/edit dialog + delete for simple admin resources.
// Each resource is declared once (fields + columns) in the section that uses it.
import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { adminApi, errorMessage, useAdminList } from './admin-api'
import { ImageUpload, LoadError, SectionHeader } from './shared'

type Option = { value: string; label: string }
export type FormField<T> = { key: string; label: string; full?: boolean; hint?: string } & (
  | { type: 'text' | 'textarea'; required?: boolean; placeholder?: string }
  | { type: 'number'; min?: number; max?: number }
  | { type: 'image'; folder: string; required?: boolean }
  | { type: 'switch' }
  | { type: 'rating' }
  | { type: 'select'; options: (items: T[], editing: T | null) => Option[]; emptyLabel?: string }
)

export interface Column<T> { label: string; render: (item: T) => React.ReactNode; className?: string }

export interface CrudConfig<T extends { id: string }> {
  endpoint: string
  title: string
  subtitle?: string
  singular: string
  fields: FormField<T>[]
  columns: Column<T>[]
  /** Text fields searched by the filter box. */
  searchText?: (item: T) => string
  /** Show an inline on/off switch bound to `isActive`. */
  activeToggle?: boolean
  /** Confirmation text for delete; defaults to a generic warning. */
  deleteWarning?: (item: T) => string
}

type FormValues = Record<string, string | boolean>
const NONE = '__none__'

function emptyForm<T>(fields: FormField<T>[]): FormValues {
  return Object.fromEntries(fields.map((f) => [f.key, f.type === 'switch' ? true : f.type === 'rating' ? '5' : f.type === 'number' ? '0' : '']))
}

function toForm<T>(fields: FormField<T>[], item: T): FormValues {
  const rec = item as Record<string, unknown>
  return Object.fromEntries(fields.map((f) => {
    const v = rec[f.key]
    return [f.key, f.type === 'switch' ? v !== false : v === null || v === undefined ? '' : String(v)]
  }))
}

function toPayload<T>(fields: FormField<T>[], form: FormValues) {
  return Object.fromEntries(fields.map((f) => {
    const v = form[f.key]
    if (f.type === 'number' || f.type === 'rating') return [f.key, v === '' ? null : Number(v)]
    return [f.key, v]
  }))
}

export function CrudSection<T extends { id: string; isActive?: boolean }>({ config }: { config: CrudConfig<T> }) {
  const { items, setItems, loading, error, reload } = useAdminList<T>(config.endpoint)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<T | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormValues>(() => emptyForm(config.fields))
  const [saving, setSaving] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q && config.searchText ? items.filter((i) => config.searchText!(i).toLowerCase().includes(q)) : items
  }, [items, query, config])

  const openCreate = () => { setEditing(null); setForm(emptyForm(config.fields)); setOpen(true) }
  const openEdit = (item: T) => { setEditing(item); setForm(toForm(config.fields, item)); setOpen(true) }
  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    const missing = config.fields.find((f) => 'required' in f && f.required && !String(form[f.key]).trim())
    if (missing) { toast.error(`${missing.label} is required`); return }
    setSaving(true)
    try {
      const payload = toPayload(config.fields, form)
      if (editing) await adminApi.put(config.endpoint, { id: editing.id, ...payload })
      else await adminApi.post(config.endpoint, payload)
      toast.success(`${config.singular} ${editing ? 'updated' : 'created'}`)
      setOpen(false)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: T) => {
    if (!confirm(config.deleteWarning?.(item) ?? `Delete this ${config.singular.toLowerCase()}? This cannot be undone.`)) return
    try {
      await adminApi.del(`${config.endpoint}?id=${encodeURIComponent(item.id)}`)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success(`${config.singular} deleted`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const toggleActive = async (item: T, isActive: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive } : i)))
    try {
      await adminApi.put(config.endpoint, { id: item.id, isActive })
      toast.success(`${config.singular} ${isActive ? 'shown' : 'hidden'} on the website`)
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: !isActive } : i)))
      toast.error(errorMessage(err))
    }
  }

  const colCount = config.columns.length + (config.activeToggle ? 1 : 0) + 1

  return (
    <div className="space-y-5">
      <SectionHeader title={config.title} subtitle={config.subtitle ?? `${items.length} total`}>
        {config.searchText && (
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="pl-9" />
          </div>
        )}
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={openCreate}>
          <Plus className="size-4" /> Add {config.singular}
        </Button>
      </SectionHeader>

      {error ? <LoadError message={error} onRetry={reload} /> : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  {config.columns.map((c) => <TableHead key={c.label} className={c.className}>{c.label}</TableHead>)}
                  {config.activeToggle && <TableHead className="text-center">Visible</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={colCount}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                  ))
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colCount} className="py-10 text-center text-muted-foreground">
                      {query ? 'No matches.' : `No ${config.title.toLowerCase()} yet. Click “Add ${config.singular}” to create one.`}
                    </TableCell>
                  </TableRow>
                ) : visible.map((item) => (
                  <TableRow key={item.id}>
                    {config.columns.map((c) => <TableCell key={c.label} className={c.className}>{c.render(item)}</TableCell>)}
                    {config.activeToggle && (
                      <TableCell className="text-center">
                        <Switch checked={item.isActive !== false} onCheckedChange={(v) => toggleActive(item, v)} aria-label="Visible on website" />
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(item)} aria-label="Edit"><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600" onClick={() => remove(item)} aria-label="Delete"><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${config.singular}` : `Add ${config.singular}`}</DialogTitle>
            <DialogDescription>Changes are saved to the live website.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {config.fields.map((f) => (
              <div key={f.key} className={`grid gap-2 ${f.full || f.type === 'textarea' || f.type === 'image' ? 'sm:col-span-2' : ''}`}>
                <FieldInput field={f} value={form[f.key]} onChange={(v) => set(f.key, v)} items={items} editing={editing} />
                {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : `Create ${config.singular}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FieldInput<T>({ field, value, onChange, items, editing }: {
  field: FormField<T>
  value: string | boolean
  onChange: (v: string | boolean) => void
  items: T[]
  editing: T | null
}) {
  const required = 'required' in field && field.required
  const label = <Label>{field.label}{required && <span className="text-red-500"> *</span>}</Label>
  switch (field.type) {
    case 'image':
      return <ImageUpload value={String(value)} onChange={onChange} folder={field.folder} label={field.required ? `${field.label} *` : field.label} />
    case 'switch':
      return (
        <label className="flex h-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <span className="text-sm font-medium">{field.label}</span>
          <Switch checked={value === true} onCheckedChange={onChange} />
        </label>
      )
    case 'textarea':
      return <>{label}<Textarea value={String(value)} onChange={(e) => onChange(e.target.value)} rows={4} placeholder={field.placeholder} /></>
    case 'number':
      return <>{label}<Input type="number" min={field.min} max={field.max} value={String(value)} onChange={(e) => onChange(e.target.value)} /></>
    case 'rating':
      return (
        <>
          {label}
          <div className="flex h-9 items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => onChange(String(n))} aria-label={`${n} stars`}>
                <Star className={`size-6 ${n <= Number(value) ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground'}`} />
              </button>
            ))}
          </div>
        </>
      )
    case 'select':
      return (
        <>
          {label}
          <Select value={String(value) || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{field.emptyLabel ?? 'None'}</SelectItem>
              {field.options(items, editing).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      )
    default:
      return <>{label}<Input value={String(value)} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} /></>
  }
}
