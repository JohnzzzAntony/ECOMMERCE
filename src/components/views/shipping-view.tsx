'use client'

import {
  Truck,
  MapPin,
  Clock,
  Gift,
  Zap,
  PackageCheck,
  Boxes,
  Search,
  Phone,
  Globe,
  ArrowRight,
} from 'lucide-react'
import { useStore } from '@/store/use-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ShippingView() {
  const { navigate, settings } = useStore()
  const whatsapp = settings.whatsapp || '971501234567'

  const sections = [
    {
      icon: MapPin,
      title: 'Delivery Areas',
      desc: 'We deliver to all seven emirates of the UAE — Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah, and Umm Al Quwain. Remote areas including Al Ain, Liwa, and the East Coast are also served.',
      points: ['All UAE emirates covered', 'Same-day in Dubai & Abu Dhabi', 'Remote areas served'],
    },
    {
      icon: Clock,
      title: 'Delivery Times',
      desc: 'Standard delivery takes 1–3 business days from order confirmation. Orders placed before 12:00 PM in Dubai and Abu Dhabi qualify for same-day delivery (subject to product availability).',
      points: ['1–3 business days standard', 'Same-day in Dubai & Abu Dhabi', 'Orders dispatched within 24h'],
    },
    {
      icon: Gift,
      title: 'Free Delivery Threshold',
      desc: 'Enjoy free standard delivery on all orders above AED 2,000. Orders below this threshold incur a flat delivery fee of AED 35 within Dubai/Abu Dhabi and AED 50 for other emirates.',
      points: ['Free delivery over AED 2,000', 'AED 35 flat — Dubai/Abu Dhabi', 'AED 50 flat — other emirates'],
    },
    {
      icon: Zap,
      title: 'Express Delivery',
      desc: 'Need it fast? Choose express delivery at checkout for 2–4 hour delivery within Dubai and Abu Dhabi (available on selected products). Express delivery is charged at AED 75 per order.',
      points: ['2–4 hour express in Dubai & Abu Dhabi', 'AED 75 flat express fee', 'Available on selected items'],
    },
    {
      icon: PackageCheck,
      title: 'Order Tracking',
      desc: 'Once your order is dispatched, you will receive an SMS and email with a tracking link. You can also track your order from your account dashboard or via WhatsApp.',
      points: ['SMS + email tracking link', 'Live updates in your account', 'WhatsApp order support'],
    },
    {
      icon: Boxes,
      title: 'Bulk & Commercial Delivery',
      desc: 'For bulk, hospital, and institutional orders, we provide dedicated delivery with installation and on-site training. Delivery is scheduled based on your convenience, and large equipment is handled by our specialized logistics team.',
      points: ['Dedicated bulk delivery', 'Installation & training included', 'Flexible scheduling'],
    },
    {
      icon: Globe,
      title: 'International Shipping',
      desc: 'We currently deliver only within the UAE. For export enquiries or specialized international orders, please contact us directly — we may be able to arrange shipment on a case-by-case basis.',
      points: ['UAE-only delivery', 'Export enquiries welcome', 'Case-by-case international'],
    },
    {
      icon: Search,
      title: 'Order Issues & Redelivery',
      desc: 'If you are not available at the time of delivery, our courier will attempt redelivery on the next business day. For any delivery-related issues, contact our customer-care team within 48 hours of receiving your order.',
      points: ['Free redelivery attempt', '48-hour issue reporting', 'Dedicated support team'],
    },
  ]

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1600)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur">
            <Truck size={28} />
          </div>
          <h1 className="text-4xl font-bold md:text-5xl">Shipping Information</h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/85">
            Fast, reliable delivery across the UAE — from same-day express in Dubai and Abu Dhabi
            to nationwide coverage in 1–3 business days.
          </p>
        </div>
      </section>

      {/* Quick highlights */}
      <section className="mx-auto max-w-7xl px-4 -mt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Clock, label: 'Same-Day', value: 'Dubai & Abu Dhabi' },
            { icon: MapPin, label: 'Coverage', value: 'All UAE Emirates' },
            { icon: Gift, label: 'Free Delivery', value: 'Over AED 2,000' },
            { icon: Zap, label: 'Express', value: '2–4 hours' },
          ].map((h) => (
            <Card key={h.label} className="text-center shadow-sm">
              <CardContent className="pt-6">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand-teal">
                  <h.icon size={18} />
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {h.label}
                </div>
                <div className="mt-1 text-sm font-bold text-brand-ink">{h.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Sections */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {sections.map((s) => (
            <Card key={s.title} className="transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-teal text-white">
                    <s.icon size={20} />
                  </div>
                  <CardTitle className="text-lg text-brand-ink">{s.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                <ul className="mt-4 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-brand-ink">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
                      {p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <Card className="mt-10 bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold">Questions About Your Delivery?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/85">
              Our team is here to help with delivery scheduling, tracking, and any shipping
              questions you may have.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                className="bg-brand-gold hover:bg-amber-600"
                onClick={() => navigate('contact')}
              >
                <Phone size={16} /> Contact Us
              </Button>
              <Button
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                asChild
              >
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                  <ArrowRight size={16} /> WhatsApp Support
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
