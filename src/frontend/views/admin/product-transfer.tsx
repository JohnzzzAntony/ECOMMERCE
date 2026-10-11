'use client'
// Catalogue import/export UI. Import is two-step: the file is checked first (dry run, nothing saved),
// the admin reviews what will be created/updated, then confirms.
import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/frontend/components/ui/table'
import { adminApi, errorMessage } from './admin-api'

interface ImportResult {
  dryRun: boolean
  columns: string[]
  ignoredColumns: string[]
  totals: { rows: number; create: number; update: number; unchanged: number; error: number }
  newTaxonomy: { categories: string[]; brands: string[]; collections: string[] }
  newFields: string[]
  rows: { row: number; action: 'create' | 'update' | 'error'; label: string; changes: string[]; errors: string[] }[]
}

/** Download a file from an admin endpoint (keeps the session cookie, surfaces server errors). */
async function download(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Download failed (${res.status})`)
  const name = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ?? 'products'
  const href = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
  URL.revokeObjectURL(href)
}

export function ExportButtons() {
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (format: 'xlsx' | 'csv') => {
    setBusy(format)
    try {
      await download(`/api/admin/products/export?format=${format}`)
      toast.success('Catalogue exported')
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(null) }
  }
  return (
    <div className="flex">
      <Button variant="outline" className="rounded-r-none" disabled={!!busy} onClick={() => run('xlsx')}>
        {busy === 'xlsx' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export Excel
      </Button>
      <Button variant="outline" className="rounded-l-none border-l-0" disabled={!!busy} onClick={() => run('csv')}>
        {busy === 'csv' ? <Loader2 className="size-4 animate-spin" /> : null} CSV
      </Button>
    </div>
  )
}

export function ImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (v: boolean) => void; onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState<'check' | 'import' | null>(null)

  const reset = () => { setFile(null); setResult(null); if (input.current) input.current.value = '' }
  const close = (v: boolean) => { if (busy) return; if (!v) reset(); onOpenChange(v) }

  const send = async (f: File, dryRun: boolean) => {
    const form = new FormData()
    form.append('file', f)
    form.append('dryRun', String(dryRun))
    setBusy(dryRun ? 'check' : 'import')
    try {
      const res = await adminApi.post<ImportResult>('/api/admin/products/import', form)
      setResult(res)
      if (!dryRun) {
        const { create, update, error } = res.totals
        if (error) toast.warning(`Imported with ${error} row${error === 1 ? '' : 's'} skipped`)
        else toast.success(`Import complete: ${create} added, ${update} updated`)
        onImported()
      }
    } catch (e) {
      toast.error(errorMessage(e))
      if (dryRun) setResult(null)
    } finally {
      setBusy(null)
    }
  }

  const pick = (f: File | undefined) => {
    if (!f) return
    setFile(f)
    send(f, true)
  }

  const t = result?.totals
  const writable = t ? t.create + t.update : 0

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-brand-teal" /> Import products</DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) or CSV file. Existing products are matched by ID, SKU, Slug or exact name and overwritten. Everything else is added as new products, so nothing is duplicated.
          </DialogDescription>
        </DialogHeader>

        {result?.dryRun && <p className="text-sm text-muted-foreground">Preview of <b>{file?.name}</b>. Nothing has been saved yet.</p>}

        {!result && (
          <div className="space-y-4">
            <label
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-brand-teal/50 hover:bg-brand-teal/5"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}
            >
              {busy ? <Loader2 className="size-8 animate-spin text-brand-teal" /> : <Upload className="size-8 text-brand-teal" />}
              <span className="font-medium">{busy ? 'Checking file…' : 'Choose a file or drop it here'}</span>
              <span className="text-xs text-muted-foreground">.xlsx or .csv, up to 10 MB</span>
              <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" disabled={!!busy} onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <p><b>Bulk edit:</b> click <i>Export Excel</i>, change the cells you need, then import the same file.</p>
              <p><b>Your own catalogue:</b> headers like Name, SKU, Price, Stock, Category, Brand and Image are recognised automatically.</p>
              <p>Columns you leave out are not changed. An empty cell clears that field. Separate several images or collections with <code>|</code>.</p>
              <button type="button" className="font-medium text-brand-teal hover:underline" onClick={() => download('/api/admin/products/export?format=xlsx&template=1').catch((e) => toast.error(errorMessage(e)))}>
                Download a blank template with instructions
              </button>
            </div>
          </div>
        )}

        {result && t && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={result.dryRun ? 'Will be added' : 'Added'} value={t.create} tone="text-emerald-700" />
              <Stat label={result.dryRun ? 'Will be updated' : 'Updated'} value={t.update} tone="text-sky-700" />
              <Stat label="Unchanged" value={t.unchanged} tone="text-slate-600" />
              <Stat label={result.dryRun ? 'Errors (skipped)' : 'Skipped'} value={t.error} tone={t.error ? 'text-red-600' : 'text-slate-600'} />
            </div>

            {!result.dryRun && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="size-4" /> Import finished. The product list has been refreshed.
              </div>
            )}

            {result.ignoredColumns.length > 0 && (
              <Notice>Ignored columns (not recognised): {result.ignoredColumns.join(', ')}</Notice>
            )}
            {(['categories', 'brands', 'collections'] as const).map((k) => result.newTaxonomy[k].length > 0 && (
              <div key={k} className="text-sm">
                <span className="text-muted-foreground">{result.dryRun ? 'New' : 'Created'} {k}: </span>
                {result.newTaxonomy[k].map((n) => <Badge key={n} variant="secondary" className="mr-1 mb-1">{n}</Badge>)}
              </div>
            ))}
            {result.newFields?.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">{result.dryRun ? 'New custom fields (added automatically)' : 'Custom fields added'}: </span>
                {result.newFields.map((n) => <Badge key={n} variant="secondary" className="mr-1 mb-1">{n}</Badge>)}
              </div>
            )}

            {result.rows.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-16">Row</TableHead><TableHead>Product</TableHead><TableHead className="w-24">Action</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[...result.rows].sort((a, b) => Number(b.action === 'error') - Number(a.action === 'error') || a.row - b.row).map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="font-mono text-xs">{r.row}</TableCell>
                        <TableCell className="max-w-48 truncate font-medium">{r.label}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={r.action === 'error' ? 'border-red-200 bg-red-50 text-red-700' : r.action === 'create' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-sky-200 bg-sky-50 text-sky-700'}>
                            {r.action === 'create' ? 'new' : r.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.errors.length ? <span className="text-red-600">{r.errors.join('; ')}</span> : <span className="text-muted-foreground">{r.changes.join(', ')}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {t.error > 0 && result.dryRun && <Notice>Rows with errors will be skipped. Fix them in the file and import again, or import the valid rows now.</Notice>}
          </div>
        )}

        <DialogFooter>
          {result?.dryRun ? (
            <>
              <Button variant="outline" disabled={!!busy} onClick={reset}>Choose another file</Button>
              <Button className="bg-brand-teal hover:bg-brand-teal-dark" disabled={!!busy || writable === 0} onClick={() => file && send(file, false)}>
                {busy === 'import' ? <><Loader2 className="size-4 animate-spin" /> Importing…</> : writable ? `Import ${writable} product${writable === 1 ? '' : 's'}` : 'Nothing to import'}
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled={!!busy} onClick={() => close(false)}>{result ? 'Done' : 'Cancel'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{children}</span></div>
}
