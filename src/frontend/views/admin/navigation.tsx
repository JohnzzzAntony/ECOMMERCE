'use client'
// Header and footer menus. Main menu: top-level items (with optional dropdown children).
// Footer menu: each top-level item is a column heading and its children are the column's links.
import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, CornerDownRight, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Input } from '@/frontend/components/ui/input'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { api } from '@/frontend/lib/api'
import { useStore } from '@/frontend/store/use-store'
import { DEFAULT_MENUS, MENU_HANDLES, type MenuHandle, type MenuItem } from '@/shared/theme'
import { adminApi, errorMessage } from './admin-api'
import { LinkPicker, useLinkTargets, type LinkTargets } from './link-picker'
import { LoadError, SectionHeader } from './shared'

const newId = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Refresh the storefront's copy of the theme + menus after an admin change. */
export function refreshStorefrontTheme() {
  api.theme().then((t) => useStore.getState().setTheme(t)).catch(() => {})
}

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

function ItemRow({ item, onChange, onRemove, onMove, targets, isChild, footer }: {
  item: MenuItem
  onChange: (item: MenuItem) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  targets: LinkTargets
  isChild?: boolean
  footer?: boolean
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-border bg-background p-3 lg:flex-row lg:items-center ${isChild ? 'ml-6' : ''}`}>
      <div className="flex items-center gap-2 lg:w-56">
        {isChild && <CornerDownRight className="size-4 shrink-0 text-muted-foreground" />}
        <Input value={item.label} onChange={(e) => onChange({ ...item, label: e.target.value })} placeholder="Label" aria-label="Label" />
      </div>
      <div className="min-w-0 flex-1">
        <LinkPicker value={item.link} onChange={(link) => onChange({ ...item, link })} targets={targets} allowMega={!isChild && !footer} allowNone={!isChild} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => onMove(1)} aria-label="Move down"><ArrowDown className="size-4" /></Button>
        {!isChild && (
          <Button variant="ghost" size="icon" aria-label="Add sub-item" title={footer ? 'Add link to this column' : 'Add dropdown item'}
            onClick={() => onChange({ ...item, children: [...(item.children ?? []), { id: newId(), label: 'New link', link: 'view:home' }] })}>
            <Plus className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={onRemove} aria-label="Remove"><Trash2 className="size-4" /></Button>
      </div>
    </div>
  )
}

function MenuEditor({ handle, saved, onSaved, targets }: { handle: MenuHandle; saved: MenuItem[]; onSaved: (items: MenuItem[]) => void; targets: LinkTargets }) {
  const [items, setItems] = useState(saved)
  const [saving, setSaving] = useState(false)
  useEffect(() => setItems(saved), [saved])
  const dirty = JSON.stringify(items) !== JSON.stringify(saved)
  const footer = handle === 'footer'

  const save = async () => {
    setSaving(true)
    try {
      const res = await adminApi.put<{ items: MenuItem[] }>('/api/admin/menus', { handle, items })
      onSaved(res.items)
      refreshStorefrontTheme()
      toast.success(`${MENU_HANDLES[handle]} saved`)
    } catch (e) { toast.error(errorMessage(e)) } finally { setSaving(false) }
  }

  const update = (i: number, item: MenuItem) => setItems(items.map((x, j) => (j === i ? item : x)))
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">{MENU_HANDLES[handle]}</CardTitle>
          <CardDescription>
            {footer ? 'Each top-level item is a column heading; use + to add links under it.' : 'Top-level links in the header. Use + for a dropdown, or "Catalog dropdown" for live categories/brands/collections.'}
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setItems(DEFAULT_MENUS[handle])} title="Load the default menu (not saved until you click Save)"><RotateCcw className="size-4" /> Defaults</Button>
          <Button variant="outline" size="sm" disabled={!dirty || saving} onClick={() => setItems(saved)}>Discard</Button>
          <Button size="sm" className="bg-brand-teal hover:bg-brand-teal-dark" disabled={!dirty || saving} onClick={save}><Save className="size-4" /> {saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">This menu is empty.</p>}
        {items.map((item, i) => (
          <div key={item.id} className="space-y-2">
            <ItemRow item={item} targets={targets} footer={footer}
              onChange={(next) => update(i, next)}
              onRemove={() => setItems(items.filter((_, j) => j !== i))}
              onMove={(d) => setItems(move(items, i, i + d))} />
            {(item.children ?? []).map((child, ci) => (
              <ItemRow key={child.id} item={child} targets={targets} isChild footer={footer}
                onChange={(next) => update(i, { ...item, children: item.children!.map((c, k) => (k === ci ? next : c)) })}
                onRemove={() => update(i, { ...item, children: item.children!.filter((_, k) => k !== ci) })}
                onMove={(d) => update(i, { ...item, children: move(item.children!, ci, ci + d) })} />
            ))}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setItems([...items, { id: newId(), label: footer ? 'New column' : 'New link', link: footer ? '' : 'view:home' }])}>
          <Plus className="size-4" /> {footer ? 'Add column' : 'Add menu item'}
        </Button>
      </CardContent>
    </Card>
  )
}

export function NavigationSection() {
  const [menus, setMenus] = useState<Record<MenuHandle, MenuItem[]> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const targets = useLinkTargets()

  const load = () => {
    adminApi.get<Record<MenuHandle, MenuItem[]>>('/api/admin/menus')
      .then((m) => { setError(null); setMenus(m) })
      .catch((e) => setError(errorMessage(e)))
  }
  useEffect(load, [])

  if (error) return <LoadError message={error} onRetry={load} />
  if (!menus) return <div className="space-y-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-96 w-full" /></div>

  return (
    <div className="space-y-5">
      <SectionHeader title="Navigation" subtitle="Menus shown in the storefront header and footer. Link to store pages, custom pages, categories, brands or any URL." />
      <Tabs defaultValue="main">
        <TabsList>
          {(Object.keys(MENU_HANDLES) as MenuHandle[]).map((h) => <TabsTrigger key={h} value={h}>{MENU_HANDLES[h]}</TabsTrigger>)}
        </TabsList>
        {(Object.keys(MENU_HANDLES) as MenuHandle[]).map((h) => (
          <TabsContent key={h} value={h}>
            <MenuEditor handle={h} saved={menus[h]} targets={targets} onSaved={(items) => setMenus({ ...menus, [h]: items })} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
