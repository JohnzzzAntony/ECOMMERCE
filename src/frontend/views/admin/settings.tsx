'use client'
// Store settings (SiteSettings key/value table). Keys marked "live" are read by the storefront today;
// the rest are stored for integrations and future use.
import { useEffect, useState } from 'react'
import { DollarSign, ExternalLink, Package, Save, Search, Settings as SettingsIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { Switch } from '@/frontend/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { Textarea } from '@/frontend/components/ui/textarea'
import { api } from '@/frontend/lib/api'
import { useStore } from '@/frontend/store/use-store'
import { adminApi, errorMessage } from './admin-api'
import { LoadError } from './shared'

type FieldDef = { key: string; label: string; type?: 'text' | 'email' | 'tel' | 'number' | 'url' | 'textarea'; placeholder?: string; live?: boolean; wide?: boolean }

const GENERAL: FieldDef[] = [
  { key: 'site_name', label: 'Store name', placeholder: 'NexEcoms' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'email', label: 'Contact email', type: 'email', live: true },
  { key: 'whatsapp', label: 'WhatsApp number', type: 'tel', placeholder: '+9715XXXXXXXX', live: true },
  { key: 'phone_dubai', label: 'Phone (Dubai)', type: 'tel', live: true },
  { key: 'phone_abudhabi', label: 'Phone (Abu Dhabi)', type: 'tel', live: true },
  { key: 'address_dubai', label: 'Address (Dubai)', type: 'textarea', live: true },
  { key: 'address_abudhabi', label: 'Address (Abu Dhabi)', type: 'textarea', live: true },
  { key: 'hours_dubai', label: 'Opening hours (Dubai)', placeholder: 'Mon–Sat 9:00–18:00', live: true },
  { key: 'hours_abudhabi', label: 'Opening hours (Abu Dhabi)', live: true },
  { key: 'top_bar_announcement', label: 'Top bar announcement', wide: true },
]
const SEO: FieldDef[] = [
  { key: 'meta_title', label: 'Default page title', placeholder: 'NexEcoms — Medical Equipment UAE', wide: true },
  { key: 'meta_description', label: 'Default meta description', type: 'textarea', wide: true },
  { key: 'meta_keywords', label: 'Keywords', placeholder: 'medical equipment, UAE, wheelchairs' },
  { key: 'ga_id', label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX' },
  { key: 'fb_pixel', label: 'Facebook Pixel ID' },
  { key: 'bing_key', label: 'Bing Webmaster key' },
]
const SOCIAL: FieldDef[] = [
  { key: 'instagram_url', label: 'Instagram URL', type: 'url' },
  { key: 'instagram_handle', label: 'Instagram handle', placeholder: '@yourstore' },
  { key: 'facebook_url', label: 'Facebook URL', type: 'url' },
  { key: 'twitter_url', label: 'X / Twitter URL', type: 'url' },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url' },
  { key: 'youtube_url', label: 'YouTube URL', type: 'url' },
  { key: 'tiktok_url', label: 'TikTok URL', type: 'url' },
  { key: 'snapchat_url', label: 'Snapchat URL', type: 'url' },
]
const PAYMENT_TOGGLES = [
  { key: 'pay_cod', label: 'Cash on Delivery', fallback: 'enabled' },
  { key: 'pay_network', label: 'Card payments', fallback: 'enabled' },
  { key: 'pay_tabby', label: 'Tabby (split in 4)', fallback: 'disabled' },
  { key: 'pay_tamara', label: 'Tamara (pay later)', fallback: 'disabled' },
  { key: 'pay_bank_transfer', label: 'Bank transfer', fallback: 'disabled' },
]
const PAYMENT: FieldDef[] = [
  { key: 'bank_details', label: 'Bank transfer details', type: 'textarea', wide: true, placeholder: 'Bank, account name, IBAN…' },
  { key: 'tabby_pk', label: 'Tabby public key' },
  { key: 'network_mid', label: 'Network International merchant ID' },
]
const SHIPPING: FieldDef[] = [
  { key: 'free_delivery_threshold', label: 'Free delivery over (AED)', type: 'number', placeholder: '2000' },
  { key: 'shipping_standard', label: 'Standard delivery (AED)', type: 'number', placeholder: '50' },
  { key: 'shipping_express', label: 'Express delivery (AED)', type: 'number', placeholder: '120' },
  { key: 'shipping_sameday', label: 'Same-day delivery (AED)', type: 'number', placeholder: '200' },
  { key: 'eta_dubai', label: 'Delivery time: Dubai', placeholder: '1–2 business days' },
  { key: 'eta_abudhabi', label: 'Delivery time: Abu Dhabi', placeholder: '2–3 business days' },
  { key: 'eta_northern', label: 'Delivery time: Sharjah & Northern Emirates', placeholder: '2–4 business days' },
  { key: 'eta_international', label: 'Delivery time: International', placeholder: '5–10 business days' },
]

function Fields({ defs, form, set }: { defs: FieldDef[]; form: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {defs.map((d) => (
        <div key={d.key} className={`grid gap-1.5 ${d.wide || d.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
          <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {d.label}{d.live && <Badge variant="outline" className="h-4 px-1 text-[9px] text-emerald-700">live</Badge>}
          </Label>
          {d.type === 'textarea'
            ? <Textarea value={form[d.key] ?? ''} onChange={(e) => set(d.key, e.target.value)} rows={2} placeholder={d.placeholder} />
            : <Input type={d.type ?? 'text'} value={form[d.key] ?? ''} onChange={(e) => set(d.key, e.target.value)} placeholder={d.placeholder} />}
        </div>
      ))}
    </div>
  )
}

function Panel({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Icon className="size-4 text-brand-teal" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export function SettingsSection() {
  const setStoreSettings = useStore((s) => s.setSettings)
  const [saved, setSaved] = useState<Record<string, string> | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('general')

  const load = () => {
    setError(null)
    api.settings().then((s) => { setSaved(s); setForm(s) }).catch((e) => setError(errorMessage(e)))
  }
  useEffect(load, [])

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const changed = saved ? Object.keys(form).filter((k) => (form[k] ?? '') !== (saved[k] ?? '')) : []

  const save = async () => {
    setSaving(true)
    try {
      const { settings } = await adminApi.put<{ settings: Record<string, string> }>('/api/admin/settings', {
        settings: Object.fromEntries(changed.map((k) => [k, form[k].trim()])),
      })
      setSaved(settings)
      setForm(settings)
      setStoreSettings(settings) // refresh the storefront copy (header/footer/contact)
      toast.success('Settings saved')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (error) return <LoadError message={error} onRetry={load} />
  if (!saved) return <div className="space-y-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-96 w-full" /></div>

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Settings</h2>
          <p className="text-sm text-muted-foreground">Fields marked <Badge variant="outline" className="h-4 px-1 text-[9px] text-emerald-700">live</Badge> are shown on the storefront.</p>
        </div>
        <div className="flex items-center gap-3">
          {changed.length > 0 && <span className="text-xs text-amber-700">{changed.length} unsaved change{changed.length === 1 ? '' : 's'}</span>}
          <Button variant="outline" disabled={!changed.length || saving} onClick={() => setForm(saved)}>Discard</Button>
          <Button className="bg-brand-teal hover:bg-brand-teal-dark" disabled={!changed.length || saving} onClick={save}><Save className="size-4" /> {saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><Panel icon={SettingsIcon} title="Store details" description="Contact information shown in the header, footer and contact page"><Fields defs={GENERAL} form={form} set={set} /></Panel></TabsContent>
        <TabsContent value="seo"><Panel icon={Search} title="SEO" description="Search engine and analytics settings"><Fields defs={SEO} form={form} set={set} /></Panel></TabsContent>
        <TabsContent value="social"><Panel icon={ExternalLink} title="Social media" description="Links to your social profiles"><Fields defs={SOCIAL} form={form} set={set} /></Panel></TabsContent>
        <TabsContent value="payment">
          <Panel icon={DollarSign} title="Payment methods" description="Which payment options you offer">
            <div className="space-y-2">
              {PAYMENT_TOGGLES.map((p) => {
                const on = (form[p.key] || p.fallback) === 'enabled'
                return (
                  <label key={p.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                    <span className="text-sm font-medium text-brand-ink">{p.label}</span>
                    <Switch checked={on} onCheckedChange={(v) => set(p.key, v ? 'enabled' : 'disabled')} />
                  </label>
                )
              })}
            </div>
            <Fields defs={PAYMENT} form={form} set={set} />
          </Panel>
        </TabsContent>
        <TabsContent value="shipping"><Panel icon={Package} title="Shipping" description="Delivery rates and estimated delivery times"><Fields defs={SHIPPING} form={form} set={set} /></Panel></TabsContent>
      </Tabs>
    </div>
  )
}
