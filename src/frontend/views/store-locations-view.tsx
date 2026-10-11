'use client'

import { MapPin, Phone, Clock, Navigation, MessageCircle, Building2 } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { Button } from '@/frontend/components/ui/button'
import { Card, CardContent } from '@/frontend/components/ui/card'

export function StoreLocationsView() {
  const { settings } = useStore()

  const locations = [
    {
      city: 'Dubai',
      address: settings.address_dubai || 'Office 1201, Business Bay Tower, Business Bay, Dubai, UAE',
      phone: settings.phone_dubai || '+971 4 123 4567',
      hours: settings.hours_dubai || 'Sat–Thu: 9:00 AM – 8:00 PM',
      mapQuery: 'Business Bay Dubai UAE',
      image: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=900',
    },
    {
      city: 'Abu Dhabi',
      address: settings.address_abudhabi || 'Hamdan Street, Tourist Club Area, Abu Dhabi, UAE',
      phone: settings.phone_abudhabi || '+971 2 765 4321',
      hours: settings.hours_abudhabi || 'Sat–Thu: 9:00 AM – 7:00 PM',
      mapQuery: 'Hamdan Street Abu Dhabi UAE',
      image: 'https://images.unsplash.com/photo-1582672060674-bc2bd808a8f5?w=900',
    },
  ]

  const whatsapp = settings.whatsapp || '971501234567'

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest">
            Visit Us
          </span>
          <h1 className="mt-4 text-4xl font-bold md:text-5xl">Our Locations</h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/80">
            Two flagship showrooms across the UAE, ready to serve you with the best medical
            equipment and expert advice.
          </p>
        </div>
      </section>

      {/* Full-width map */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="overflow-hidden rounded-2xl border shadow-sm">
          <iframe
            title="NexEcoms - UAE Locations Map"
            src="https://maps.google.com/maps?q=Dubai%20UAE&t=&z=9&ie=UTF8&iwloc=&output=embed"
            className="h-[420px] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      {/* Location cards */}
      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {locations.map((loc) => (
            <Card key={loc.city} className="overflow-hidden py-0">
              <div className="relative h-52 overflow-hidden">
                <img
                  src={loc.image}
                  alt={`${loc.city} showroom`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-ink/70 to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-white/80">
                      Store Showroom
                    </div>
                    <div className="text-xl font-bold">{loc.city}</div>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-4 p-6">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-teal">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Address
                    </div>
                    <div className="text-sm text-brand-ink">{loc.address}</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-teal">
                    <Phone size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Phone
                    </div>
                    <a
                      href={`tel:${loc.phone}`}
                      className="text-sm font-medium text-brand-ink hover:text-brand-teal"
                    >
                      {loc.phone}
                    </a>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-teal">
                    <Clock size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Working Hours
                    </div>
                    <div className="text-sm text-brand-ink">{loc.hours}</div>
                  </div>
                </div>

                {/* Mini map */}
                <div className="overflow-hidden rounded-lg border">
                  <iframe
                    title={`Mini map - ${loc.city}`}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(loc.mapQuery)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                    className="h-44 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-brand-teal hover:bg-brand-teal-dark"
                    asChild
                  >
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.mapQuery)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation size={16} /> Get Directions
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                      <MessageCircle size={16} /> WhatsApp
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional info */}
        <Card className="mt-8 bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-bold">Can&apos;t Visit in Person?</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/85">
              We offer same-day delivery across Dubai and Abu Dhabi, and 1–3 day delivery across
              all UAE emirates. Shop online or contact our team for assistance.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button className="bg-brand-gold hover:bg-amber-600" asChild>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} /> Chat with us
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
