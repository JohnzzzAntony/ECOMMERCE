'use client'

import { FileText, ChevronRight } from 'lucide-react'
import { useStore } from '@/frontend/store/use-store'
import { Card, CardContent } from '@/frontend/components/ui/card'

type Section = { title: string; body: string[] }

const LAST_UPDATED = 'January 15, 2025'

const SECTIONS: Section[] = [
  {
    title: '1. Introduction',
    body: [
      'Welcome to NexEcoms ("we," "our," "us"). These Terms and Conditions ("Terms") govern your use of our website, online store, and related services (collectively, the "Services").',
      'By accessing or using our Services, you agree to be bound by these Terms. If you do not agree with any part of these Terms, please do not use our Services. These Terms constitute a legally binding agreement between you and NexEcoms.',
      'NexEcoms is a medical equipment supplier registered in the United Arab Emirates, with its principal place of business in Dubai. Our services are offered to customers located within the UAE.',
    ],
  },
  {
    title: '2. Use of Site',
    body: [
      'You may use our website only for lawful purposes and in accordance with these Terms. You agree not to use the site in any way that could damage, disable, overload, or impair the site or interfere with any other party\'s use.',
      'You must not attempt to gain unauthorized access to any part of the site, other systems, or networks connected to the site, through hacking, password mining, or any other means.',
      'We reserve the right to suspend or terminate access to the site at our sole discretion, without notice, if we believe you have violated these Terms or any applicable law.',
    ],
  },
  {
    title: '3. Products & Pricing',
    body: [
      'All products displayed on our website are subject to availability. We make every effort to ensure product descriptions, images, and pricing are accurate at the time of publication. However, errors may occur, and we reserve the right to correct any such errors without prior notice.',
      'Prices are listed in UAE Dirhams (AED) and include VAT where applicable. Prices may change at any time without notice. The price applicable to your order is the price displayed at the time of order confirmation.',
      'We reserve the right to refuse or cancel any order at our discretion, including in cases of pricing errors, stock unavailability, or suspected fraudulent activity. In such cases, any payment made will be refunded in full.',
    ],
  },
  {
    title: '4. Orders & Enquiries',
    body: [
      'When you place an order through our website, you will receive an order confirmation via email. This confirmation does not constitute acceptance of your order — it simply acknowledges that we have received it.',
      'Acceptance of your order takes place when we dispatch the products and send a dispatch confirmation. Until that point, we may decline to accept an order for any valid reason.',
      'For product enquiries, bulk orders, or specialized requirements, you may submit an enquiry through our contact form or WhatsApp. Our team will respond within one business day.',
    ],
  },
  {
    title: '5. Payment',
    body: [
      'We accept the following payment methods: Cash on Delivery (COD), major credit/debit cards (Visa, Mastercard, American Express), bank transfers, and Buy Now Pay Later (BNPL) services including Tabby and Tamara.',
      'For institutional and bulk orders, we accept purchase orders subject to credit approval. Payment terms for such orders will be specified in the proforma invoice.',
      'All payments are processed through secure, PCI-compliant payment gateways. We do not store your full card details on our servers. By submitting payment, you authorize us to charge the agreed amount for your order.',
    ],
  },
  {
    title: '6. Delivery',
    body: [
      'We deliver to all seven emirates of the UAE. Standard delivery takes 1–3 business days. Same-day delivery is available in Dubai and Abu Dhabi for orders placed before 12:00 PM.',
      'Free standard delivery is offered on orders above AED 2,000. For orders below this threshold, a flat delivery fee applies: AED 35 within Dubai/Abu Dhabi and AED 50 for other emirates.',
      'Risk of loss or damage to products passes to you upon delivery. Please inspect all products upon receipt and report any damage or shortage within 48 hours. Late reports may not be eligible for replacement.',
    ],
  },
  {
    title: '7. Returns & Refunds',
    body: [
      'You may return unused, unopened products in their original packaging within 7 days of delivery for a full refund. Returns must be authorized by our customer-care team prior to shipment.',
      'Certain products are non-returnable for health and safety reasons, including but not limited to: compression garments, incontinence products, custom-made items, opened hygiene products, and consumables.',
      'Refunds are processed within 7–10 business days of receiving the returned product, provided it meets our return conditions. Refunds are issued to the original payment method. Original delivery charges are non-refundable except in cases of product defect or our error.',
    ],
  },
  {
    title: '8. Warranty',
    body: [
      'All products are covered by the manufacturer\'s original warranty, the duration of which varies by product category and is specified on each product page.',
      'Warranty covers manufacturing defects only. It does not cover damage caused by misuse, negligence, unauthorized repair, normal wear and tear, or failure to follow the manufacturer\'s instructions.',
      'To make a warranty claim, please contact our customer-care team with your order number and a description of the issue. We will arrange inspection, repair, or replacement as appropriate.',
    ],
  },
  {
    title: '9. Limitation of Liability',
    body: [
      'To the fullest extent permitted by UAE law, NexEcoms shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our Services or any products purchased through us.',
      'Our total liability for any claim arising from or relating to your use of our Services shall not exceed the total amount you paid to us for the relevant product order.',
      'Nothing in these Terms shall limit or exclude liability that cannot be limited or excluded under applicable UAE law, including liability for fraud, gross negligence, or willful misconduct.',
    ],
  },
  {
    title: '10. Intellectual Property',
    body: [
      'All content on this website — including text, graphics, logos, images, software, and the overall look and feel — is the property of NexEcoms or its licensors and is protected by UAE and international intellectual property laws.',
      'You may view, download, and print content from this site for your personal, non-commercial use only. You may not reproduce, distribute, modify, or otherwise use any content without our prior written consent.',
      'All product names, brand names, and trademarks are the property of their respective owners. Their appearance on our website does not imply endorsement or affiliation beyond our authorized distribution relationships.',
    ],
  },
  {
    title: '11. Privacy',
    body: [
      'Your use of our Services is also governed by our Privacy Policy, which describes how we collect, use, and protect your personal information. The Privacy Policy is incorporated into these Terms by reference.',
      'By using our Services, you consent to the data practices described in our Privacy Policy.',
    ],
  },
  {
    title: '12. Changes to Terms',
    body: [
      'We may update these Terms from time to time to reflect changes in our practices, legal requirements, or other operational reasons. The "Last Updated" date at the top of this page indicates the most recent revision.',
      'Continued use of our Services after any changes to these Terms constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.',
    ],
  },
  {
    title: '13. Contact',
    body: [
      'If you have any questions, concerns, or feedback regarding these Terms, please contact us using the details below:',
      'Email: info@yourstore.com',
      'Phone (Dubai): +971 4 123 4567',
      'Phone (Abu Dhabi): +971 2 765 4321',
      'WhatsApp: +971 50 123 4567',
      'Address: Office 1201, Business Bay Tower, Business Bay, Dubai, UAE',
    ],
  },
]

export function TermsView() {
  const { navigate } = useStore()

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur">
            <FileText size={28} />
          </div>
          <h1 className="text-4xl font-bold md:text-5xl">Terms &amp; Conditions</h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/85">
            Please read these terms carefully before using our website and services.
          </p>
          <p className="mt-4 text-xs uppercase tracking-widest text-white/70">
            Last Updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* TOC */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Table of Contents
                </h2>
                <nav className="space-y-1 text-sm">
                  {SECTIONS.map((s) => (
                    <a
                      key={s.title}
                      href={`#${s.title.replace(/[.\s]+/g, '-').toLowerCase()}`}
                      className="flex items-start gap-1.5 rounded-md px-2 py-1.5 text-brand-ink hover:bg-accent hover:text-brand-teal"
                    >
                      <ChevronRight size={14} className="mt-0.5 shrink-0 text-brand-teal" />
                      <span className="line-clamp-1">{s.title.replace(/^\d+\.\s*/, '')}</span>
                    </a>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* Content */}
          <div className="space-y-6">
            <Card>
              <CardContent className="prose prose-sm max-w-none space-y-6 pt-6">
                <p className="rounded-lg border-l-4 border-brand-gold bg-accent/50 p-4 text-sm text-brand-ink">
                  These Terms and Conditions were last updated on{' '}
                  <strong>{LAST_UPDATED}</strong>. By using our website and services, you agree to
                  the terms outlined below.
                </p>

                {SECTIONS.map((s) => (
                  <section
                    key={s.title}
                    id={s.title.replace(/[.\s]+/g, '-').toLowerCase()}
                    className="scroll-mt-24"
                  >
                    <h2 className="mb-3 text-xl font-bold text-brand-ink">{s.title}</h2>
                    <div className="space-y-3">
                      {s.body.map((p, i) => (
                        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                          {p}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
              <CardContent className="p-8 text-center">
                <h2 className="text-xl font-bold">Questions About Our Terms?</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/85">
                  If you have any questions or need clarification on any part of these Terms,
                  our team is happy to help.
                </p>
                <button
                  onClick={() => navigate('contact')}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-gold px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                >
                  Contact Us
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
