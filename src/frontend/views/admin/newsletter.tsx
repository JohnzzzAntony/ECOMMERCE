'use client'
import { useMemo, useState } from 'react'
import { Download, Mail, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Input } from '@/frontend/components/ui/input'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Switch } from '@/frontend/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/frontend/components/ui/table'
import { formatDate, formatNumber } from '@/frontend/lib/format'
import { adminApi, errorMessage, useAdminList } from './admin-api'
import { LoadError, StatusBadge } from './shared'

interface Subscriber { id: string; email: string; subscribedAt: string; isActive: boolean }

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

export function NewsletterSection() {
  const { items, setItems, loading, error, reload } = useAdminList<Subscriber>('/api/admin/newsletter')
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((s) => s.email.toLowerCase().includes(q)) : items
  }, [items, query])
  const active = items.filter((s) => s.isActive)

  const exportCsv = () => {
    const rows = [['Email', 'Subscribed At', 'Status'], ...active.map((s) => [s.email, s.subscribedAt, 'Active'])]
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${active.length} active subscribers`)
  }

  const setActive = async (s: Subscriber, isActive: boolean) => {
    try {
      await adminApi.put('/api/admin/newsletter', { id: s.id, isActive })
      setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, isActive } : x)))
      toast.success(isActive ? 'Subscriber resumed' : 'Subscriber paused')
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const remove = async (s: Subscriber) => {
    if (!confirm(`Remove ${s.email} permanently?`)) return
    try {
      await adminApi.del(`/api/admin/newsletter?id=${encodeURIComponent(s.id)}`)
      setItems((prev) => prev.filter((x) => x.id !== s.id))
      toast.success('Subscriber removed')
    } catch (e) { toast.error(errorMessage(e)) }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white sm:col-span-2">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/70"><Mail className="size-4" /> Active Subscribers</div>
              <div className="mt-2 text-4xl font-bold">{loading ? '—' : formatNumber(active.length)}</div>
              <div className="mt-1 text-sm text-white/70">{items.length - active.length} paused</div>
            </div>
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10"><Mail className="size-8 text-brand-gold" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col justify-between gap-3 pt-6">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Export</div>
              <div className="mt-1 text-sm text-brand-ink">Download active subscribers as CSV for your email platform.</div>
            </div>
            <Button className="bg-brand-gold text-white hover:bg-brand-gold/90" onClick={exportCsv} disabled={active.length === 0}><Download className="size-4" /> Export CSV</Button>
          </CardContent>
        </Card>
      </div>

      {error ? <LoadError message={error} onRetry={reload} /> : (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Subscribers</CardTitle>
              <CardDescription>{visible.length} shown</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email…" className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            {loading && items.length === 0 ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center"><Mail className="size-10 text-muted-foreground/40" /><p className="mt-2 text-sm text-muted-foreground">{items.length ? 'No matches' : 'No subscribers yet'}</p></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Subscribed</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Active</TableHead><TableHead className="text-right">Remove</TableHead></TableRow></TableHeader>
                <TableBody>
                  {visible.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(s.subscribedAt)}</TableCell>
                      <TableCell><StatusBadge status={s.isActive ? 'active' : 'inactive'} /></TableCell>
                      <TableCell className="text-center"><Switch checked={s.isActive} onCheckedChange={(v) => setActive(s, v)} aria-label="Active" /></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => remove(s)} aria-label="Remove"><Trash2 className="size-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
