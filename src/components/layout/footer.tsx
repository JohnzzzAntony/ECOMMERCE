'use client'

import { Instagram, Facebook, MessageCircle, Phone, Mail, MapPin, Send } from 'lucide-react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { useState } from 'react'
import { toast } from 'sonner'

export function Footer() {
  const { navigate, settings } = useStore()
  const [email, setEmail] = useState('')
  // Use store settings directly (fetched on app mount); fallback to defaults
  const localSettings = settings

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

  return (
    <footer className="mt-auto bg-brand-ink text-white">
      {/* Newsletter band */}
      <div className="border-b border-white/10 bg-brand-teal-dark">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 md:flex-row md:justify-between">
          <div>
            <h3 className="text-xl font-bold">Stay in the Loop</h3>
            <p className="mt-1 text-sm text-white/70">Subscribe to our newsletter for exclusive offers and updates.</p>
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
      </div>

      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal text-white font-bold">JKR</div>
              <div>
                <div className="text-base font-bold">JKR International</div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">Medical Equipment</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/70">
              {localSettings?.tagline || 'Delivering world-class medical equipment across the UAE'}
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

          {/* Categories */}
          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/90">Categories</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><button onClick={() => navigate('products-category', { categorySlug: 'wheelchairs' })} className="hover:text-brand-cyan transition-colors">Wheelchairs</button></li>
              <li><button onClick={() => navigate('products-category', { categorySlug: 'walking-aids' })} className="hover:text-brand-cyan transition-colors">Walking Aids</button></li>
              <li><button onClick={() => navigate('products-category', { categorySlug: 'physiotherapy' })} className="hover:text-brand-cyan transition-colors">Physiotherapy</button></li>
              <li><button onClick={() => navigate('products-category', { categorySlug: 'hospital-equipment' })} className="hover:text-brand-cyan transition-colors">Hospital Equipment</button></li>
              <li><button onClick={() => navigate('products-category', { categorySlug: 'home-care' })} className="hover:text-brand-cyan transition-colors">Home Care</button></li>
              <li><button onClick={() => navigate('products-category', { categorySlug: 'diagnostics' })} className="hover:text-brand-cyan transition-colors">Diagnostics</button></li>
            </ul>
          </div>

          {/* Information */}
          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/90">Information</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><button onClick={() => navigate('about')} className="hover:text-brand-cyan transition-colors">About Us</button></li>
              <li><button onClick={() => navigate('contact')} className="hover:text-brand-cyan transition-colors">Contact Us</button></li>
              <li><button onClick={() => navigate('store-locations')} className="hover:text-brand-cyan transition-colors">Store Locations</button></li>
              <li><button onClick={() => navigate('shipping-info')} className="hover:text-brand-cyan transition-colors">Shipping Info</button></li>
              <li><button onClick={() => navigate('track-order')} className="hover:text-brand-cyan transition-colors">Track Order</button></li>
              <li><button onClick={() => navigate('faq')} className="hover:text-brand-cyan transition-colors">FAQ</button></li>
              <li><button onClick={() => navigate('terms')} className="hover:text-brand-cyan transition-colors">Terms & Conditions</button></li>
              <li><button onClick={() => navigate('privacy')} className="hover:text-brand-cyan transition-colors">Privacy Policy</button></li>
            </ul>
          </div>

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
                <a href={`mailto:${localSettings?.email}`} className="hover:text-brand-cyan">{localSettings?.email || 'info@jkrinternational.com'}</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment & copyright */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 md:flex-row">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/60">We Accept:</span>
            <PaymentBadge label="COD" color="bg-emerald-600" />
            <PaymentBadge label="Tabby" color="bg-sky-500" />
            <PaymentBadge label="Tamara" color="bg-pink-500" />
            <PaymentBadge label="Network" color="bg-purple-600" />
          </div>
          <p className="text-center text-xs text-white/50 md:text-right">
            © {new Date().getFullYear()} JKR International. All rights reserved. ·
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
