'use client'

import { useState } from 'react'
import {
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  Send,
  Building2,
  PhoneCall,
} from 'lucide-react'
import { useStore } from '@/store/use-store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export function ContactView() {
  const { settings } = useStore()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const phoneDubai = settings.phone_dubai || '+971 4 123 4567'
  const phoneAbuDhabi = settings.phone_abudhabi || '+971 2 765 4321'
  const whatsapp = settings.whatsapp || '971501234567'
  const email = settings.email || 'info@jkrinternational.com'
  const addressDubai = settings.address_dubai || 'Office 1201, Business Bay Tower, Business Bay, Dubai, UAE'
  const addressAbuDhabi = settings.address_abudhabi || 'Hamdan Street, Tourist Club Area, Abu Dhabi, UAE'
  const hoursDubai = settings.hours_dubai || 'Sat–Thu: 9:00 AM – 8:00 PM'
  const hoursAbuDhabi = settings.hours_abudhabi || 'Sat–Thu: 9:00 AM – 7:00 PM'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    try {
      await api.contact(form)
      toast.success('Message sent! We will get back to you shortly.')
      setForm({ name: '', email: '', phone: '', subject: '', message: '' })
    } catch {
      toast.error('Failed to send message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest">
            We&apos;re Here to Help
          </span>
          <h1 className="mt-4 text-4xl font-bold md:text-5xl">Contact Us</h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/80">
            Have a question about our products or services? Reach out to our team — we typically
            respond within a few hours during business days.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-2xl">Send Us a Message</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={update('name')}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={update('email')}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={update('phone')}
                      placeholder="+971 50 123 4567"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={form.subject}
                      onChange={update('subject')}
                      placeholder="Product enquiry, support, etc."
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message">
                    Message <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={update('message')}
                    placeholder="How can we help you?"
                    rows={6}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-brand-teal hover:bg-brand-teal-dark sm:w-auto"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Send Message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Info */}
          <div className="space-y-6">
            {/* Quick contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal text-white">
                    <Mail size={18} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div className="text-sm font-medium text-brand-ink">{email}</div>
                  </div>
                </a>
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white">
                    <MessageCircle size={18} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">WhatsApp</div>
                    <div className="text-sm font-medium text-brand-ink">+{whatsapp}</div>
                  </div>
                </a>
              </CardContent>
            </Card>

            {/* Dubai office */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 size={18} className="text-brand-teal" /> Dubai Office
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-brand-teal" />
                  <span className="text-muted-foreground">{addressDubai}</span>
                </div>
                <div className="flex gap-2">
                  <Phone size={16} className="mt-0.5 shrink-0 text-brand-teal" />
                  <a href={`tel:${phoneDubai}`} className="text-brand-ink hover:text-brand-teal">
                    {phoneDubai}
                  </a>
                </div>
                <div className="flex gap-2">
                  <Clock size={16} className="mt-0.5 shrink-0 text-brand-teal" />
                  <span className="text-muted-foreground">{hoursDubai}</span>
                </div>
              </CardContent>
            </Card>

            {/* Abu Dhabi office */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 size={18} className="text-brand-teal" /> Abu Dhabi Office
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-brand-teal" />
                  <span className="text-muted-foreground">{addressAbuDhabi}</span>
                </div>
                <div className="flex gap-2">
                  <PhoneCall size={16} className="mt-0.5 shrink-0 text-brand-teal" />
                  <a href={`tel:${phoneAbuDhabi}`} className="text-brand-ink hover:text-brand-teal">
                    {phoneAbuDhabi}
                  </a>
                </div>
                <div className="flex gap-2">
                  <Clock size={16} className="mt-0.5 shrink-0 text-brand-teal" />
                  <span className="text-muted-foreground">{hoursAbuDhabi}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Map */}
        <div className="mt-10 overflow-hidden rounded-2xl border shadow-sm">
          <iframe
            title="JKR International - Dubai Office Location"
            src="https://maps.google.com/maps?q=Dubai%20Business%20Bay&t=&z=12&ie=UTF8&iwloc=&output=embed"
            className="h-[400px] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  )
}
