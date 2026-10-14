'use client'
// Figma connection for this store: sign in with Figma (OAuth) or paste a personal access token.
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, LogIn, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { adminApi, errorMessage } from './admin-api'
import { LoadError } from './shared'

type Connection = {
  handle: string; email: string | null; authType: 'OAUTH' | 'PAT'; status: 'ACTIVE' | 'NEEDS_REAUTH'
  scopes: string[]; expiresAt: string | null; connectedAt: string
}
type State = { connection: Connection | null; oauthAvailable: boolean; canManage: boolean }

const CALLBACK_MESSAGES: Record<string, [ok: boolean, text: string]> = {
  connected: [true, 'Figma account connected'],
  denied: [false, 'Figma access was not granted'],
  rate_limited: [false, 'Too many attempts. Wait a few minutes and try again.'],
  error: [false, 'Could not connect Figma. Start again from this page.'],
}

export function FigmaSection() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const [revokeHelp, setRevokeHelp] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    return adminApi.get<State>('/api/design/figma/connection').then(setState).catch((e) => setError(errorMessage(e)))
  }, [])

  useEffect(() => {
    load()
    // Result of the OAuth round trip (?figma=...), shown once and removed from the address bar.
    const url = new URL(window.location.href)
    const result = url.searchParams.get('figma')
    if (result && CALLBACK_MESSAGES[result]) {
      const [ok, text] = CALLBACK_MESSAGES[result]
      if (ok) toast.success(text); else toast.error(text)
      url.searchParams.delete('figma')
      window.history.replaceState(null, '', url)
    }
  }, [load])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try { await action() } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  const signIn = () => run(async () => {
    const { url } = await adminApi.post<{ url: string }>('/api/design/figma/oauth/start', {})
    window.location.href = url
  })

  const savePat = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      await adminApi.post('/api/design/figma/pat', { token: token.trim() })
      setToken('')
      setRevokeHelp(null)
      toast.success('Figma account connected')
      await load()
    })
  }

  const disconnect = () => {
    if (!window.confirm('Disconnect Figma? Imported pages stay installed; imports and updates stop until you connect again.')) return
    run(async () => {
      const res = await adminApi.del<{ revokeHelp: string }>('/api/design/figma/connection')
      setRevokeHelp(res.revokeHelp)
      toast.success('Figma disconnected')
      await load()
    })
  }

  if (error) return <LoadError message={error} onRetry={load} />
  if (!state) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-brand-teal" /></div>

  const { connection: c, canManage, oauthAvailable } = state
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Figma account
            {c && (c.status === 'ACTIVE'
              ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-3" /> Connected</Badge>
              : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800"><AlertTriangle className="size-3" /> Reconnect needed</Badge>)}
          </CardTitle>
          <CardDescription>Designs are copied from Figma when you import them. Your storefront never loads anything from Figma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {c ? (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Account</dt><dd className="font-medium">{c.handle}{c.email ? ` · ${c.email}` : ''}</dd></div>
              <div><dt className="text-muted-foreground">Method</dt><dd>{c.authType === 'OAUTH' ? 'Signed in with Figma' : 'Personal access token'}</dd></div>
              <div><dt className="text-muted-foreground">Connected</dt><dd>{new Date(c.connectedAt).toLocaleString()}</dd></div>
              {c.scopes.length > 0 && <div><dt className="text-muted-foreground">Permissions</dt><dd className="break-words font-mono text-xs">{c.scopes.join(', ')}</dd></div>}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No Figma account is connected to this store.</p>
          )}
          {c?.status === 'NEEDS_REAUTH' && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Figma no longer accepts this store's access. Connect again to resume imports; installed pages are not affected.
            </p>
          )}
          {!canManage && <p className="text-sm text-muted-foreground">Only store owners and admins can connect or disconnect Figma.</p>}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {oauthAvailable && (
                <Button onClick={signIn} disabled={busy} className="bg-brand-teal hover:bg-brand-teal-dark">
                  <LogIn className="size-4" /> {c ? 'Reconnect with Figma' : 'Connect with Figma'}
                </Button>
              )}
              {c && <Button variant="outline" onClick={disconnect} disabled={busy}><Unplug className="size-4" /> Disconnect</Button>}
            </div>
          )}
          {revokeHelp && <p className="rounded-md border bg-muted/50 p-3 text-sm">{revokeHelp}</p>}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> Use a personal access token</CardTitle>
            <CardDescription>
              {oauthAvailable ? 'Alternative to signing in.' : 'Figma sign-in is not configured on this server, so connect with a token.'}{' '}
              In Figma open Settings → Security → Personal access tokens and create one with at least the
              <span className="font-mono"> current_user:read</span>, <span className="font-mono">file_content:read</span> and
              <span className="font-mono"> file_metadata:read</span> scopes. The token is encrypted and never shown again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePat} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="figma-pat">Personal access token</Label>
                <Input id="figma-pat" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} placeholder="figd_…" />
              </div>
              <Button type="submit" disabled={busy || token.trim().length < 20}>{busy ? <Loader2 className="size-4 animate-spin" /> : null} Save token</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
