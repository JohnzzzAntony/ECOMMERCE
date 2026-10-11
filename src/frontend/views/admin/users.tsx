'use client'
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
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
import { formatDate } from '@/frontend/lib/format'
import { useStore } from '@/frontend/store/use-store'
import { adminApi, errorMessage, useAdminList } from './admin-api'
import { initials, LoadError, SectionHeader } from './shared'

interface AdminUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  role: string
  isActive: boolean
  createdAt: string
  _count: { orders: number; enquiries: number }
}

const ROLES = [
  { value: 'customer', label: 'Customer' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Administrator' },
]
const ALL = 'all'
const fullName = (u: AdminUser) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0]

export function UsersSection() {
  const { items, setItems, loading, error, reload } = useAdminList<AdminUser>('/api/admin/users')
  const me = useStore((s) => s.user?.id)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState(ALL)
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((u) => (role === ALL || u.role === role)
      && (!q || `${fullName(u)} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(q)))
  }, [items, query, role])

  const toggleActive = async (u: AdminUser, isActive: boolean) => {
    try {
      const { user } = await adminApi.put<{ user: AdminUser }>('/api/admin/users', { id: u.id, isActive })
      setItems((prev) => prev.map((x) => (x.id === user.id ? user : x)))
      toast.success(`${fullName(u)} ${isActive ? 'activated' : 'deactivated'}`)
    } catch (e) { toast.error(errorMessage(e)) }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Users" subtitle={`${items.length} accounts · ${items.filter((u) => u.role === 'admin').length} administrators`}>
        <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => setEditing('new')}><Plus className="size-4" /> Add User</Button>
      </SectionHeader>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email, phone…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error ? <LoadError message={error} onRetry={reload} /> : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead>
                  <TableHead>Activity</TableHead><TableHead>Joined</TableHead><TableHead className="text-center">Active</TableHead><TableHead className="text-right">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell></TableRow>)
                ) : visible.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No users found.</TableCell></TableRow>
                ) : visible.map((u) => (
                  <TableRow key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`flex size-9 items-center justify-center rounded-full text-xs font-bold text-white ${u.role === 'admin' ? 'bg-brand-teal' : u.role === 'staff' ? 'bg-brand-cyan' : 'bg-brand-ink'}`}>{initials(fullName(u))}</div>
                        <div className="font-medium">{fullName(u)}{u.id === me && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={u.role === 'admin' ? 'border-brand-teal/20 bg-brand-teal/10 text-brand-teal' : 'border-slate-200 bg-slate-100 text-slate-700'}>
                        {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u._count.orders} orders · {u._count.enquiries} enquiries</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={u.isActive} disabled={u.id === me} onCheckedChange={(v) => toggleActive(u, v)} aria-label="Active" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(u)} aria-label="Edit"><Pencil className="size-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <UserDialog
        user={editing}
        isSelf={editing !== 'new' && editing?.id === me}
        onClose={() => setEditing(null)}
        onSaved={(user, created) => {
          setItems((prev) => (created ? [user, ...prev] : prev.map((x) => (x.id === user.id ? user : x))))
          setEditing(null)
        }}
      />
    </div>
  )
}

const blank = { email: '', firstName: '', lastName: '', phone: '', role: 'customer', password: '', isActive: true }

function UserDialog({ user, isSelf, onClose, onSaved }: {
  user: AdminUser | 'new' | null
  isSelf: boolean
  onClose: () => void
  onSaved: (u: AdminUser, created: boolean) => void
}) {
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const isNew = user === 'new'

  useEffect(() => {
    if (!user) return
    setForm(user === 'new' ? blank : {
      email: user.email, firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '',
      role: user.role, password: '', isActive: user.isActive,
    })
  }, [user])

  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.email.trim()) { toast.error('Email is required'); return }
    if (isNew && form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (!isNew && form.password && form.password.length < 8) { toast.error('New password must be at least 8 characters'); return }
    setSaving(true)
    try {
      const { password, ...rest } = form
      const payload = password ? form : rest
      const res = isNew
        ? await adminApi.post<{ user: AdminUser }>('/api/admin/users', payload)
        : await adminApi.put<{ user: AdminUser }>('/api/admin/users', { id: (user as AdminUser).id, ...payload })
      toast.success(isNew ? 'User created' : password ? 'User updated and password reset' : 'User updated')
      onSaved(res.user, isNew)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add User' : 'Edit User'}</DialogTitle>
          <DialogDescription>{isNew ? 'Share the password with the user securely; they can sign in right away.' : 'Leave the password empty to keep the current one.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2"><Label>Email <span className="text-red-500">*</span></Label><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="grid gap-2"><Label>First name</Label><Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
          <div className="grid gap-2"><Label>Last name</Label><Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
          <div className="grid gap-2"><Label>Phone</Label><Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => set('role', v)} disabled={isSelf}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>{isNew ? <>Password <span className="text-red-500">*</span></> : 'New password'}</Label>
            <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 8 characters" />
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2">
            Account active
            <Switch checked={form.isActive} disabled={isSelf} onCheckedChange={(v) => set('isActive', v)} />
          </label>
          {form.role === 'admin' && !isSelf && <p className="text-xs text-amber-700 sm:col-span-2">Administrators have full access to this panel.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={submit} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create User' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
