'use client'

import {
  Award,
  Globe2,
  Headset,
  Truck,
  Target,
  Eye,
  HeartHandshake,
  ArrowRight,
  CheckCircle2,
  Stethoscope,
  Users,
  Building2,
} from 'lucide-react'
import { useStore } from '@/store/use-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function AboutView() {
  const { navigate } = useStore()

  const stats = [
    { label: 'Happy Clients', value: '500+', icon: Users },
    { label: 'Products Delivered', value: '10,000+', icon: Stethoscope },
    { label: 'Years Experience', value: '15+', icon: Award },
    { label: 'Showrooms', value: '2', icon: Building2 },
  ]

  const whyChoose = [
    {
      icon: Award,
      title: 'ISO Certified',
      desc: 'All our products meet international ISO and CE quality standards for medical devices.',
    },
    {
      icon: Globe2,
      title: 'Global Brands',
      desc: 'We partner with world-leading manufacturers to bring you authentic, certified equipment.',
    },
    {
      icon: Headset,
      title: 'Expert Support',
      desc: 'Our trained specialists provide product guidance, installation, and after-sales support.',
    },
    {
      icon: Truck,
      title: 'Fast Delivery',
      desc: 'Same-day delivery in Dubai & Abu Dhabi, and 1–3 day delivery across all UAE emirates.',
    },
  ]

  const mvv = [
    {
      icon: Target,
      title: 'Our Mission',
      desc: 'To empower healthcare providers and families across the UAE with reliable, high-quality medical equipment — improving patient outcomes and quality of life.',
    },
    {
      icon: Eye,
      title: 'Our Vision',
      desc: 'To be the most trusted medical equipment partner in the region, recognized for our integrity, expertise, and unwavering commitment to care.',
    },
    {
      icon: HeartHandshake,
      title: 'Our Values',
      desc: 'Integrity, compassion, excellence, and innovation guide every decision we make and every relationship we build with our customers.',
    },
  ]

  const team = [
    { name: 'Khalid Al Rashed', role: 'Founder & CEO', avatar: 'https://i.pravatar.cc/200?img=12' },
    { name: 'Dr. Aisha Mansoor', role: 'Medical Director', avatar: 'https://i.pravatar.cc/200?img=45' },
    { name: 'Rajesh Kumar', role: 'Head of Operations', avatar: 'https://i.pravatar.cc/200?img=33' },
    { name: 'Layla Hassan', role: 'Customer Care Lead', avatar: 'https://i.pravatar.cc/200?img=20' },
  ]

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-teal via-brand-teal-dark to-brand-ink text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=1600)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest backdrop-blur">
            About Us
          </span>
          <h1 className="mt-4 text-4xl font-bold md:text-6xl">About JKR International</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">
            For over 15 years, JKR International has been a trusted name in medical equipment
            supply across the UAE — delivering quality, care, and reliability to clinics,
            hospitals, and homes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              className="bg-brand-gold hover:bg-amber-600"
              onClick={() => navigate('contact')}
            >
              Contact Us <ArrowRight size={16} />
            </Button>
            <Button
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => navigate('products')}
            >
              Browse Products
            </Button>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-gold">
              Our Story
            </span>
            <h2 className="mt-3 text-3xl font-bold text-brand-ink md:text-4xl">
              Delivering Healthcare Solutions Since 2009
            </h2>
            <div className="mt-6 space-y-4 text-muted-foreground">
              <p>
                Founded in 2009, JKR International began as a small family-run supplier of
                mobility aids in Dubai. Today, we are one of the UAE&apos;s leading medical
                equipment distributors, serving hospitals, clinics, pharmacies, rehabilitation
                centers, and individual families across all seven emirates.
              </p>
              <p>
                Our journey has always been driven by a single belief — that everyone deserves
                access to reliable, certified medical equipment. From wheelchairs and
                physiotherapy devices to hospital-grade diagnostics and home-care essentials, we
                source authentic products from the world&apos;s most respected manufacturers.
              </p>
              <p>
                With two flagship showrooms in Dubai and Abu Dhabi, a dedicated team of certified
                specialists, and an unwavering commitment to after-sales service, JKR
                International is your trusted partner in healthcare.
              </p>
            </div>
            <ul className="mt-6 space-y-2">
              {[
                'Certified, authentic medical equipment',
                'Same-day delivery within Dubai & Abu Dhabi',
                'Free installation & product training',
                'Dedicated after-sales support team',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-brand-ink">
                  <CheckCircle2 size={18} className="text-brand-teal" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-2xl shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1551076805-e1869033e561?w=900"
                alt="JKR International team"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-brand-gold p-6 text-white shadow-xl md:block">
              <div className="text-3xl font-bold">15+</div>
              <div className="text-xs uppercase tracking-wide">Years of Excellence</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-gradient-to-r from-brand-teal to-brand-teal-dark text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-12 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                <s.icon size={24} />
              </div>
              <div className="text-3xl font-bold md:text-4xl">{s.value}</div>
              <div className="mt-1 text-sm text-white/80">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why choose us */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-gold">
              Why Choose Us
            </span>
            <h2 className="mt-3 text-3xl font-bold text-brand-ink md:text-4xl">
              The JKR Advantage
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              We combine global sourcing with local expertise to deliver an unmatched medical
              equipment experience.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {whyChoose.map((f) => (
              <Card key={f.title} className="text-center transition-all hover:shadow-md">
                <CardContent className="pt-8">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-brand-teal">
                    <f.icon size={26} />
                  </div>
                  <h3 className="text-lg font-bold text-brand-ink">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mission / Vision / Values */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-gold">
              What Drives Us
            </span>
            <h2 className="mt-3 text-3xl font-bold text-brand-ink md:text-4xl">
              Mission, Vision &amp; Values
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {mvv.map((m) => (
              <Card key={m.title} className="border-t-4 border-t-brand-teal">
                <CardContent className="pt-8">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-teal text-white">
                    <m.icon size={22} />
                  </div>
                  <h3 className="text-xl font-bold text-brand-ink">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-gold">
              Our Team
            </span>
            <h2 className="mt-3 text-3xl font-bold text-brand-ink md:text-4xl">
              Meet the People Behind JKR
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              A dedicated team of healthcare professionals, engineers, and customer-care
              specialists.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((m) => (
              <Card key={m.name} className="overflow-hidden text-center py-0">
                <div className="relative h-56 w-full overflow-hidden">
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <CardContent className="py-5">
                  <h3 className="font-bold text-brand-ink">{m.name}</h3>
                  <p className="text-sm text-brand-teal">{m.role}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-brand-ink to-brand-teal-dark py-16 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Ready to Find the Right Medical Equipment?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/80">
            Our specialists are ready to help you choose the best products for your needs —
            whether for a hospital, clinic, or home.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              className="bg-brand-gold hover:bg-amber-600"
              onClick={() => navigate('contact')}
            >
              Contact Us <ArrowRight size={16} />
            </Button>
            <Button
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => navigate('store-locations')}
            >
              Visit Our Showrooms
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
