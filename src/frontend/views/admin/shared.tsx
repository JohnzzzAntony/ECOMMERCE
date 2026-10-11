'use client'
// Small building blocks shared by the admin sections.
import { useState } from 'react'
import { AlertTriangle, ImageOff, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent } from '@/frontend/components/ui/card'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { adminApi, errorMessage } from './admin-api'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-sky-100 text-sky-800 border-sky-200',
  shipped: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  new: 'bg-purple-100 text-purple-800 border-purple-200',
  contacted: 'bg-sky-100 text-sky-800 border-sky-200',
  quoted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  closed: 'bg-slate-100 text-slate-700 border-slate-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  refunded: 'bg-amber-100 text-amber-800 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  hidden: 'bg-slate-100 text-slate-600 border-slate-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`capitalize ${STATUS_STYLES[(status || '').toLowerCase()] || STATUS_STYLES.closed}`}>
      {status}
    </Badge>
  )
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'A'
}

export function SectionHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-brand-ink">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertTriangle className="size-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
      </CardContent>
    </Card>
  )
}

export function Thumb({ src, alt, className = 'size-11' }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  return src && failed !== src ? (
    <img src={src} alt={alt} onError={() => setFailed(src)} className={`${className} shrink-0 rounded-md border border-border object-cover`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground`}>
      <ImageOff className="size-4" />
    </div>
  )
}

/** Upload to Cloudinary via /api/admin/upload, or paste an existing image URL. */
export function ImageUpload({ value, onChange, folder, label = 'Image' }: {
  value: string
  onChange: (url: string) => void
  folder: string
  label?: string
}) {
  const [uploading, setUploading] = useState(false)

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    form.append('folder', folder)
    setUploading(true)
    try {
      const { url } = await adminApi.post<{ url: string }>('/api/admin/upload', form)
      onChange(url)
      toast.success('Image uploaded')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <div className="relative">
          <Thumb src={value} alt="Preview" className="size-16" />
          {value && (
            <button type="button" onClick={() => onChange('')} aria-label="Remove image"
              className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white">
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="grid flex-1 gap-2">
          <Input type="file" accept="image/*" onChange={upload} disabled={uploading} className="cursor-pointer text-xs" />
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image URL" className="text-xs" />
          {uploading && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Uploading…</p>}
        </div>
      </div>
    </div>
  )
}

export function StatCard({ label, value, icon: Icon, accent, sublabel, onClick }: {
  label: string
  value: string | number
  icon: React.ElementType
  accent: 'teal' | 'gold' | 'cyan' | 'ink'
  sublabel?: string
  onClick?: () => void
}) {
  const accentMap = {
    teal: 'bg-brand-teal/10 text-brand-teal',
    gold: 'bg-brand-gold/10 text-brand-gold',
    cyan: 'bg-brand-cyan/10 text-brand-cyan',
    ink: 'bg-brand-ink/10 text-brand-ink',
  }
  return (
    <Card className={`overflow-hidden ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`} onClick={onClick}>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 truncate text-2xl font-bold text-brand-ink">{value}</div>
          {sublabel && <div className="mt-1 text-xs font-medium text-muted-foreground">{sublabel}</div>}
        </div>
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${accentMap[accent]}`}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}
