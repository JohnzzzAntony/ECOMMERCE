'use client'
// Design system: tokens extracted from Figma (editable), WCAG contrast warnings, activation, fonts, media library.
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { sizedImage } from '@/frontend/lib/image'
import { contrastIssues, EMPTY_TOKENS, type DesignTokens } from '@/shared/design-tokens'
import { adminApi, errorMessage } from '../admin-api'
import type { Asset } from './fields'

type SystemState = { active: { id: string; version: number } | null; draft: { id: string; version: number } | null; editing: { id: string; version: number; status: string; tokens: DesignTokens | null } | null; history: { id: string; version: number; status: string; createdAt: string }[] }
type Font = { id: string; family: string; weights: number[]; source: 'GOOGLE' | 'UPLOAD'; files: number }

export function DesignSystemSection() {
  const [state, setState] = useState<SystemState | null>(null)
  const [tokens, setTokens] = useState<DesignTokens>(EMPTY_TOKENS)
  const [dirty, setDirty] = useState(false)
  const [fonts, setFonts] = useState<Font[]>([])
  const load = useCallback(async () => {
    const s = await adminApi.get<SystemState>('/api/design/system')
    setState(s); setTokens(s.editing?.tokens ?? EMPTY_TOKENS); setDirty(false)
    setFonts(await adminApi.get<Font[]>('/api/design/fonts'))
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set after the request resolves
  useEffect(() => { load().catch((e) => toast.error(errorMessage(e))) }, [load])

  const edit = (next: DesignTokens) => { setTokens(next); setDirty(true) }
  const save = async () => { try { await adminApi.put('/api/design/system', { tokens }); toast.success('Saved as draft'); await load() } catch (e) { toast.error(errorMessage(e)) } }
  const activate = async (id: string) => { try { await adminApi.post('/api/design/system/activate', { id }); toast.success('Design system is live'); await load() } catch (e) { toast.error(errorMessage(e)) } }

  if (!state) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div>
  const contrast = contrastIssues(tokens)
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Design tokens</CardTitle>
            <CardDescription>Colours, type and spacing from your Figma styles. Live: {state.active ? `v${state.active.version}` : 'none'}{state.draft ? ` · draft v${state.draft.version}` : ''}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={save} disabled={!dirty}><Save className="size-4" /> Save draft</Button>
            {state.draft && !dirty && <Button className="bg-brand-teal hover:bg-brand-teal-dark" onClick={() => activate(state.draft!.id)}>Make live</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {contrast.length > 0 ? (
            <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" /> Contrast below WCAG AA</div>
              {contrast.map((c, i) => <div key={i}>“{c.text}” on “{c.background}”: {c.ratio}:1</div>)}
            </div>
          ) : tokens.colors.length > 0 && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> Text/background colour pairs meet WCAG AA.</p>}

          <section className="space-y-2">
            <h3 className="font-semibold">Colours</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tokens.colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                  <input type="color" aria-label={`${c.name} colour`} value={c.value.slice(0, 7)} onChange={(e) => edit({ ...tokens, colors: tokens.colors.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} className="h-9 w-10 rounded border" />
                  <Input value={c.name} aria-label="Token name" onChange={(e) => edit({ ...tokens, colors: tokens.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <Button variant="ghost" size="icon" aria-label={`Remove ${c.name}`} onClick={() => edit({ ...tokens, colors: tokens.colors.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => edit({ ...tokens, colors: [...tokens.colors, { name: `Color ${tokens.colors.length + 1}`, value: '#000000', source: 'observed', usage: 0 }] })}><Plus className="size-4" /> Colour</Button>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">Typography</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-1">Name</th><th className="p-1">Family</th><th className="p-1">Size</th><th className="p-1">Weight</th><th className="p-1">Line height</th><th className="p-1">Letter spacing</th></tr></thead>
                <tbody>
                  {tokens.typography.map((t, i) => {
                    const set = (patch: Partial<typeof t>) => edit({ ...tokens, typography: tokens.typography.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
                    return (
                      <tr key={i}>
                        <td className="p-1"><Input value={t.name} onChange={(e) => set({ name: e.target.value })} aria-label="Name" /></td>
                        <td className="p-1"><Input value={t.family} onChange={(e) => set({ family: e.target.value })} aria-label="Family" /></td>
                        <td className="p-1"><Input type="number" value={t.size} onChange={(e) => set({ size: Number(e.target.value) })} aria-label="Size" className="w-20" /></td>
                        <td className="p-1"><Input type="number" step={100} value={t.weight} onChange={(e) => set({ weight: Number(e.target.value) })} aria-label="Weight" className="w-20" /></td>
                        <td className="p-1"><Input type="number" value={t.lineHeight ?? ''} onChange={(e) => set({ lineHeight: e.target.value ? Number(e.target.value) : null })} aria-label="Line height" className="w-20" /></td>
                        <td className="p-1"><Input type="number" step={0.1} value={t.letterSpacing} onChange={(e) => set({ letterSpacing: Number(e.target.value) })} aria-label="Letter spacing" className="w-20" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            {(['spacing', 'radius'] as const).map((k) => (
              <div key={k} className="space-y-1"><Label className="capitalize">{k} scale (px, comma separated)</Label>
                <Input defaultValue={tokens[k].join(', ')} key={tokens[k].join(',')} onBlur={(e) => edit({ ...tokens, [k]: e.target.value.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v) && v >= 0) })} />
              </div>
            ))}
            <div className="space-y-1"><Label>Content width (px)</Label><Input type="number" value={tokens.container} onChange={(e) => edit({ ...tokens, container: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Breakpoints (tablet / desktop)</Label><div className="flex gap-2"><Input type="number" value={tokens.breakpoints.tablet} onChange={(e) => edit({ ...tokens, breakpoints: { ...tokens.breakpoints, tablet: Number(e.target.value) } })} /><Input type="number" value={tokens.breakpoints.desktop} onChange={(e) => edit({ ...tokens, breakpoints: { ...tokens.breakpoints, desktop: Number(e.target.value) } })} /></div></div>
          </section>

          {state.history.length > 1 && (
            <section className="space-y-2"><h3 className="font-semibold">Versions</h3>
              <ul className="divide-y rounded-md border text-sm">{state.history.map((h) => <li key={h.id} className="flex items-center gap-3 p-2">v{h.version}<Badge variant="outline" className="capitalize">{h.status.toLowerCase()}</Badge><span className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>{h.status !== 'ACTIVE' && <Button size="sm" variant="outline" className="ml-auto" onClick={() => activate(h.id)}>Make live</Button>}</li>)}</ul>
            </section>
          )}
        </CardContent>
      </Card>
      <FontsCard fonts={fonts} families={[...new Set(tokens.typography.map((t) => t.family))]} onChanged={load} />
    </div>
  )
}

function FontsCard({ fonts, families, onChanged }: { fonts: Font[]; families: string[]; onChanged: () => void }) {
  const [form, setForm] = useState({ family: '', weight: 400, style: 'normal', licensed: false })
  const [file, setFile] = useState<File | null>(null)
  const missing = families.filter((f) => !fonts.some((x) => x.family.toLowerCase() === f.toLowerCase()))
  const upload = async () => {
    if (!file) return
    const data = new FormData()
    data.append('file', file); data.append('family', form.family); data.append('weight', String(form.weight)); data.append('style', form.style); data.append('licensed', String(form.licensed))
    try { await adminApi.post('/api/design/fonts', data); toast.success('Font uploaded'); setFile(null); onChanged() } catch (e) { toast.error(errorMessage(e)) }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Fonts</CardTitle><CardDescription>Google Fonts in your design are self-hosted automatically. Other fonts must be uploaded — you are responsible for holding a web font licence.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {missing.length > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">Missing font files: {missing.join(', ')}. A fallback font is shown until you upload them.</p>}
        <ul className="divide-y rounded-md border text-sm">{fonts.map((f) => <li key={f.id} className="flex items-center gap-3 p-2"><span className="font-medium">{f.family}</span><span className="text-xs text-muted-foreground">{f.weights.join(', ')}</span><Badge variant="outline">{f.source === 'GOOGLE' ? 'Google Fonts' : 'Uploaded'}</Badge></li>)}{!fonts.length && <li className="p-2 text-muted-foreground">No fonts yet.</li>}</ul>
        <div className="grid gap-2 sm:grid-cols-[1fr_100px_120px_auto] sm:items-end">
          <div className="space-y-1"><Label>Family</Label><Input list="missing-fonts" value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value })} /><datalist id="missing-fonts">{missing.map((m) => <option key={m} value={m} />)}</datalist></div>
          <div className="space-y-1"><Label>Weight</Label><Input type="number" step={100} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Style</Label><select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}><option value="normal">Normal</option><option value="italic">Italic</option></select></div>
          <Button asChild variant="outline"><label className="cursor-pointer"><Upload className="size-4" /> {file ? file.name.slice(0, 18) : 'Choose file'}<input type="file" accept=".woff2,.woff,.ttf,.otf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></Button>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.licensed} onChange={(e) => setForm({ ...form, licensed: e.target.checked })} /> I hold a licence to use this font on the web.</label>
        <Button onClick={upload} disabled={!file || !form.family || !form.licensed}>Upload font</Button>
      </CardContent>
    </Card>
  )
}

export function MediaLibrarySection() {
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [onlyMissing, setOnlyMissing] = useState(false)
  const load = useCallback(() => adminApi.get<Asset[]>('/api/design/assets').then(setAssets).catch((e) => toast.error(errorMessage(e))), [])
  useEffect(() => { load() }, [load])
  const saveAlt = async (a: Asset, alt: string) => {
    try { await adminApi.patch(`/api/design/assets/${a.id}`, { alt }); setAssets((x) => x?.map((y) => (y.id === a.id ? { ...y, alt, altReviewed: true } : y)) ?? null) } catch (e) { toast.error(errorMessage(e)) }
  }
  const upload = async (file: File) => { const f = new FormData(); f.append('file', file); try { await adminApi.post('/api/design/assets', f); load() } catch (e) { toast.error(errorMessage(e)) } }
  if (!assets) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div>
  const shown = assets.filter((a) => !onlyMissing || !a.altReviewed)
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div><CardTitle>Media library</CardTitle><CardDescription>Images copied from Figma start with the layer name as alt text — review each one. {assets.filter((a) => !a.altReviewed).length} need review.</CardDescription></div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Needs review only</label>
          <Button asChild variant="outline"><label className="cursor-pointer"><Upload className="size-4" /> Upload<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label></Button>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((a) => (
            <li key={a.id} className="space-y-2 rounded-md border p-2">
              <div className="flex aspect-[4/3] items-center justify-center bg-muted"><img src={a.mime === 'image/svg+xml' ? a.url : sizedImage(a.url, 320)} alt="" className="max-h-full max-w-full object-contain" loading="lazy" /></div>
              <div className="text-xs text-muted-foreground">{a.width}×{a.height} {!a.altReviewed && <Badge variant="outline" className="ml-1 border-amber-200 bg-amber-50 text-amber-800">Review alt</Badge>}</div>
              <Input defaultValue={a.alt} aria-label="Alt text" placeholder="Describe the image" onBlur={(e) => e.target.value !== a.alt || !a.altReviewed ? saveAlt(a, e.target.value) : undefined} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
