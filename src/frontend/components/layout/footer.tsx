'use client'

import { Instagram, Facebook, MessageCircle, Phone, Mail, MapPin, Send } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { api } from '@/frontend/lib/api'
import { useState } from 'react'
import { toast } from 'sonner'
import { StoreLogo } from '@/frontend/components/layout/header'
import { settingText, useFollowLink, useTheme } from '@/frontend/lib/theme'
import type { MenuItem } from '@/shared/theme'

/** Theme setting `footer_style` picks the layout. */
export function Footer() {
  const { settings } = useTheme()
  return settings.footer_style === 'classic' ? <ClassicFooter /> : <EditorialFooter />
}

/** Footer menu: top-level items with children become columns; loose top-level links share one column. */
function useFooterColumns(): MenuItem[] {
  const { menus } = useTheme()
  const loose = menus.footer.filter((i) => !i.children?.length && i.link)
  return [
    ...menus.footer.filter((i) => i.children?.length),
    ...(loose.length ? [{ id: 'footer-links', label: 'Links', link: '', children: loose }] : []),
  ]
}

function useNewsletter() {
  const [email, setEmail] = useState('')
  const subscribe = async () => {
    if (!email) return
    try {
      await api.newsletter(email)
      toast.success('Subscribed successfully!')
      setEmail('')
    } catch {
      toast.error('Subscription failed')
    }
  }
  return { email, setEmail, subscribe }
}

function EditorialFooter() {
  const { navigate, settings: store } = useStore()
  const { settings: theme } = useTheme()
  const followLink = useFollowLink()
  const columns = useFooterColumns()
  const { email, setEmail, subscribe } = useNewsletter()

  return (
    <footer data-section-id="@footer" data-section-label="Footer" className="relative mt-auto border-t border-border bg-background text-brand-ink">
      {theme.show_footer_newsletter === true && (
        <div className="border-b border-border">
          <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-14 sm:px-8 md:grid-cols-2 md:items-end">
            <div>
              <h3 className="text-3xl leading-tight sm:text-4xl">{settingText(theme.footer_newsletter_title)}</h3>
              {theme.footer_newsletter_text ? <p className="mt-3 text-sm text-muted-foreground">{settingText(theme.footer_newsletter_text)}</p> : null}
            </div>
            <div className="flex items-center border-b border-brand-ink">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && subscribe()}
                placeholder="Your email"
                aria-label="Email address"
                className="flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
              />
              <button onClick={subscribe} className="py-3 pl-4 text-sm underline-offset-4 hover:underline">Sign up</button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          <div>
            <StoreLogo />
            <p className="mt-4 max-w-xs whitespace-pre-line text-sm text-muted-foreground">{settingText(theme.footer_about) || store?.tagline}</p>
            <div className="mt-5 flex gap-4">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:opacity-70"><Instagram size={18} strokeWidth={1.5} /></a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:opacity-70"><Facebook size={18} strokeWidth={1.5} /></a>
              <a href="https://wa.me/971501234567" target="_blank" rel="noreferrer" aria-label="WhatsApp" className="hover:opacity-70"><MessageCircle size={18} strokeWidth={1.5} /></a>
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.id}>
              <h4 className="mb-4 text-base">{col.label}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {(col.children ?? []).map((link) => (
                  <li key={link.id}><button onClick={() => followLink(link.link)} className="text-left transition-colors hover:text-brand-ink">{link.label}</button></li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4 className="mb-4 text-base">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>{store?.address_dubai || 'Business Bay, Dubai, UAE'}</li>
              <li>{store?.address_abudhabi || 'Hamdan Street, Abu Dhabi, UAE'}</li>
              <li><a href={`tel:${store?.phone_dubai}`} className="hover:text-brand-ink">{store?.phone_dubai || '+971 4 123 4567'}</a></li>
              <li><a href={`mailto:${store?.email}`} className="hover:text-brand-ink">{store?.email || 'info@yourstore.com'}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          {theme.show_payment_badges ? (
            <div className="flex flex-wrap items-center gap-3"><span>We accept</span>{['COD', 'Tabby', 'Tamara', 'Network'].map((l) => <span key={l} className="border border-border px-2 py-0.5">{l}</span>)}</div>
          ) : <div />}
          <p>
            © {new Date().getFullYear()} {settingText(theme.copyright_text)} ·
            <button onClick={() => navigate('privacy')} className="ml-1 hover:text-brand-ink">Privacy</button> ·
            <button onClick={() => navigate('terms')} className="ml-1 hover:text-brand-ink">Terms</button>
          </p>
        </div>
      </div>
    </footer>
  )
}

function ClassicFooter() {
  const { navigate, settings } = useStore()
  const { email, setEmail, subscribe } = useNewsletter()
  // Use store settings directly (fetched on app mount); fallback to defaults
  const localSettings = settings
  const { settings: theme } = useTheme()
  const followLink = useFollowLink()
  const columns = useFooterColumns()

  return (
    <footer data-section-id="@footer" data-section-label="Footer" className="relative mt-auto bg-brand-ink text-white">
      {/* Newsletter band */}
      {theme.show_footer_newsletter && <div className="border-b border-white/10 bg-brand-teal-dark">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 md:flex-row md:justify-between">
          <div>
            <h3 className="text-xl font-bold">{settingText(theme.footer_newsletter_title)}</h3>
            <p className="mt-1 text-sm text-white/70">{settingText(theme.footer_newsletter_text)}</p>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && subscribe()}
              placeholder="Enter your email"
              className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-brand-cyan focus:outline-none"
            />
            <button
              onClick={subscribe}
              className="flex items-center gap-1.5 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
            >
              <Send size={14} /> Subscribe
            </button>
          </div>
        </div>
      </div>}

      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {/* Brand */}
          <div>
            <StoreLogo dark />
            <p className="mt-4 whitespace-pre-line text-sm text-white/70">
              {settingText(theme.footer_about) || localSettings?.tagline}
            </p>
            <div className="mt-4 flex gap-2">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-brand-cyan transition-colors">
                <Instagram size={16} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-brand-cyan transition-colors">
                <Facebook size={16} />
              </a>
              <a href="https://wa.me/971501234567" target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-brand-cyan transition-colors">
                <MessageCircle size={16} />
              </a>
            </div>
          </div>

          {/* Menu columns (theme "Footer menu": each top-level item is a column) */}
          {columns.map((col) => (
            <div key={col.id}>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/90">{col.label}</h4>
              <ul className="space-y-2 text-sm text-white/70">
                {(col.children ?? []).map((link) => (
                  <li key={link.id}><button onClick={() => followLink(link.link)} className="hover:text-brand-cyan transition-colors text-left">{link.label}</button></li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/90">Contact</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-brand-cyan" />
                <span>Dubai: {localSettings?.address_dubai || 'Business Bay, Dubai, UAE'}</span>
              </li>
              <li className="flex gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-brand-cyan" />
                <span>Abu Dhabi: {localSettings?.address_abudhabi || 'Hamdan Street, Abu Dhabi, UAE'}</span>
              </li>
              <li className="flex gap-2">
                <Phone size={16} className="mt-0.5 shrink-0 text-brand-cyan" />
                <a href={`tel:${localSettings?.phone_dubai}`} className="hover:text-brand-cyan">{localSettings?.phone_dubai || '+971 4 123 4567'}</a>
              </li>
              <li className="flex gap-2">
                <Mail size={16} className="mt-0.5 shrink-0 text-brand-cyan" />
                <a href={`mailto:${localSettings?.email}`} className="hover:text-brand-cyan">{localSettings?.email || 'info@yourstore.com'}</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment & copyright */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 md:flex-row">
          {theme.show_payment_badges ? <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/60">We Accept:</span>
            <PaymentBadge label="COD" color="bg-emerald-600" />
            <PaymentBadge label="Tabby" color="bg-sky-500" />
            <PaymentBadge label="Tamara" color="bg-pink-500" />
            <PaymentBadge label="Network" color="bg-purple-600" />
          </div> : <div />}
          <p className="text-center text-xs text-white/50 md:text-right">
            © {new Date().getFullYear()} {settingText(theme.copyright_text)}. All rights reserved. ·
            <button onClick={() => navigate('privacy')} className="ml-1 hover:text-brand-cyan">Privacy</button> ·
            <button onClick={() => navigate('terms')} className="ml-1 hover:text-brand-cyan">Terms</button>
          </p>
        </div>
      </div>
    </footer>
  )
}

function PaymentBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`rounded px-2 py-1 text-[10px] font-bold text-white ${color}`}>{label}</span>
  )
}
