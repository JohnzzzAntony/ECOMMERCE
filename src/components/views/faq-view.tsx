'use client'

import { useState } from 'react'
import { HelpCircle, MessageCircle, ArrowRight, Search } from 'lucide-react'
import { useStore } from '@/store/use-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

type FAQ = { category: string; q: string; a: string }

const FAQS: FAQ[] = [
  {
    category: 'Orders',
    q: 'How long does delivery take within the UAE?',
    a: 'Standard delivery takes 1–3 business days across all UAE emirates. For Dubai and Abu Dhabi, we offer same-day delivery on orders placed before 12:00 PM (subject to product availability). Express delivery is also available at an additional charge.',
  },
  {
    category: 'Payment',
    q: 'What payment methods do you accept?',
    a: 'We accept Cash on Delivery (COD), all major credit/debit cards (Visa, Mastercard, Amex), bank transfers, and BNPL options including Tabby and Tamara. For institutional and bulk orders, we also accept purchase orders with pre-approved credit terms.',
  },
  {
    category: 'Products',
    q: 'Do your products come with a warranty?',
    a: 'Yes. All products come with the manufacturer\'s original warranty, typically ranging from 1 to 3 years depending on the product category. Warranty details are listed on each product page. Extended warranty options are available for select items.',
  },
  {
    category: 'Orders',
    q: 'What is your return and exchange policy?',
    a: 'You may return unused, unopened products in their original packaging within 7 days of delivery for a full refund. Custom-made or hygiene-related products (such as compression stockings or incontinence supplies) are non-returnable for health and safety reasons. Please contact us to initiate a return.',
  },
  {
    category: 'Orders',
    q: 'Can I place bulk or institutional orders?',
    a: 'Absolutely. We serve hospitals, clinics, pharmacies, and government institutions across the UAE. Bulk orders qualify for discounted pricing and dedicated account management. Contact our B2B team at info@jkrinternational.com or via WhatsApp for a custom quotation.',
  },
  {
    category: 'Services',
    q: 'Do you offer installation and product training?',
    a: 'Yes. For hospital equipment, mobility aids, and complex devices, we provide free installation and user training within Dubai and Abu Dhabi. For other emirates, installation can be arranged at a nominal fee. Our certified technicians ensure your equipment is set up correctly and safely.',
  },
  {
    category: 'Services',
    q: 'Do you provide maintenance and repair services?',
    a: 'Yes, we offer annual maintenance contracts (AMC) and on-demand repair services for all equipment purchased from us. Our service team carries genuine spare parts and follows manufacturer-approved repair protocols. Contact us to schedule a service visit.',
  },
  {
    category: 'Products',
    q: 'Can I customize products to my specific needs?',
    a: 'Many of our products can be customized — including wheelchairs (seat width, back height), walking aids (height adjustment), and home-care beds (motor configuration). Custom orders typically take 2–4 weeks. Reach out to our team with your requirements.',
  },
  {
    category: 'Shipping',
    q: 'Which areas do you serve?',
    a: 'We deliver to all seven emirates — Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah, and Umm Al Quwain. We also deliver to remote areas such as Liwa and Al Ain, with delivery times of 3–4 business days.',
  },
  {
    category: 'Account',
    q: 'How can I track my order?',
    a: 'Once your order is dispatched, you will receive an SMS and email with a tracking link. You can also track your order from your account dashboard, or contact our customer-care team via WhatsApp for real-time updates.',
  },
  {
    category: 'Payment',
    q: 'Do you offer international shipping?',
    a: 'Currently, we only deliver within the UAE. For international enquiries, please contact us — we may be able to arrange export shipments on a case-by-case basis for bulk or specialized orders.',
  },
  {
    category: 'Account',
    q: 'Do I need to create an account to place an order?',
    a: 'No, you can check out as a guest. However, creating a free account allows you to track orders, save addresses, manage wishlists, and reorder previous purchases with a single click.',
  },
]

const CATEGORIES = ['All', 'Orders', 'Products', 'Payment', 'Shipping', 'Services', 'Account']

export function FaqView() {
  const { navigate } = useStore()
  const [activeCat, setActiveCat] = useState('All')
  const [query, setQuery] = useState('')

  const filtered = FAQS.filter((f) => {
    const matchCat = activeCat === 'All' || f.category === activeCat
    const matchSearch =
      !query ||
      f.q.toLowerCase().includes(query.toLowerCase()) ||
      f.a.toLowerCase().includes(query.toLowerCase())
    return matchCat && matchSearch
  })

  const whatsapp = useStore((s) => s.settings.whatsapp) || '971501234567'

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur">
            <HelpCircle size={28} />
          </div>
          <h1 className="text-4xl font-bold md:text-5xl">Frequently Asked Questions</h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/80">
            Find quick answers to common questions about our products, orders, delivery, and
            services.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            type="search"
            placeholder="Search FAQs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 pl-10"
          />
        </div>

        {/* Category tabs */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCat === cat
                  ? 'bg-brand-teal text-white'
                  : 'bg-white text-brand-ink hover:bg-accent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Accordion */}
        {filtered.length > 0 ? (
          <Card>
            <CardContent className="pt-2">
              <Accordion type="single" collapsible className="w-full">
                {filtered.map((f, i) => (
                  <AccordionItem key={`${f.q}-${i}`} value={`item-${i}`}>
                    <AccordionTrigger className="text-left text-base font-semibold text-brand-ink hover:no-underline">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No FAQs match your search. Try a different keyword.
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <Card className="mt-10 bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold">Still Have Questions?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/85">
              Our customer-care team is ready to help. Reach out and we&apos;ll get back to you
              within a few hours during business days.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                className="bg-brand-gold hover:bg-amber-600"
                onClick={() => navigate('contact')}
              >
                Contact Us <ArrowRight size={16} />
              </Button>
              <Button
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                asChild
              >
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} /> WhatsApp Us
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
