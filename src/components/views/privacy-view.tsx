'use client'

import { ShieldCheck, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/use-store'
import { Card, CardContent } from '@/components/ui/card'

type Section = { title: string; body: string[] }

const LAST_UPDATED = 'January 15, 2025'

const SECTIONS: Section[] = [
  {
    title: '1. Information We Collect',
    body: [
      'JKR International ("we," "our," "us") is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and the choices you have regarding your personal data.',
      'We collect the following types of information when you interact with our website and services:',
      'Personal Information: When you create an account, place an order, or contact us, we may collect your name, email address, phone number, delivery address, and payment information.',
      'Order Information: Details of products you purchase, order history, delivery preferences, and any notes or specifications you provide.',
      'Technical Information: When you visit our website, we automatically collect your IP address, browser type, device information, pages visited, and the time and date of your visit, through cookies and similar technologies.',
      'Communication Information: Any messages, emails, or other communications you send to us, including customer-service enquiries and product reviews.',
    ],
  },
  {
    title: '2. How We Use Information',
    body: [
      'We use the information we collect for the following purposes:',
      'To process and fulfil your orders, including delivery, returns, and refunds.',
      'To communicate with you about your orders, account, and enquiries, including order confirmations, dispatch notifications, and customer-service responses.',
      'To improve our website, products, and services — including personalizing your experience, analyzing usage trends, and developing new features.',
      'To send you marketing communications such as newsletters, promotional offers, and product updates — only if you have opted in. You can opt out at any time via the unsubscribe link in our emails or by contacting us.',
      'To comply with legal obligations, prevent fraud, and protect the rights and safety of our customers, employees, and partners.',
    ],
  },
  {
    title: '3. Cookies',
    body: [
      'Our website uses cookies and similar technologies to enhance your browsing experience, analyze website traffic, and remember your preferences.',
      'Essential cookies are necessary for the website to function correctly and cannot be disabled. They enable core features such as shopping cart management, account login, and secure checkout.',
      'Analytics cookies help us understand how visitors use our website so we can improve its performance. Marketing cookies allow us to show you relevant products and offers based on your browsing behavior.',
      'You can control and manage cookies through your browser settings. Please note that disabling certain cookies may affect the functionality of the website.',
    ],
  },
  {
    title: '4. Information Sharing',
    body: [
      'We do not sell, rent, or trade your personal information to third parties. We may share your information with the following categories of recipients, strictly as needed to deliver our services:',
      'Service Providers: Logistics partners for delivery, payment processors for transactions, and IT service providers for website hosting and analytics. These providers are contractually bound to protect your information and use it only for the purposes we specify.',
      'Manufacturers: When warranty claims or product registrations are required, we may share relevant order details with the product manufacturer.',
      'Legal Authorities: If required by UAE law, court order, or government authority, or to protect our rights, property, or safety, we may disclose information as necessary.',
      'Business Transfers: In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction, subject to the protections described in this policy.',
    ],
  },
  {
    title: '5. Data Security',
    body: [
      'We implement industry-standard technical, organizational, and physical safeguards to protect your personal information from unauthorized access, alteration, disclosure, or destruction.',
      'These measures include SSL/TLS encryption for data in transit, secure data storage, access controls limited to authorized personnel, and regular security assessments.',
      'While we strive to protect your information, no method of transmission or storage is 100% secure. We cannot guarantee absolute security, but we are committed to promptly investigating and addressing any data breach in accordance with UAE data protection laws.',
    ],
  },
  {
    title: '6. Your Rights',
    body: [
      'You have the following rights regarding your personal information:',
      'Access: You may request a copy of the personal information we hold about you.',
      'Correction: You may request that we correct any inaccurate or incomplete information.',
      'Deletion: You may request that we delete your personal information, subject to legal retention requirements.',
      'Opt-out: You may opt out of marketing communications at any time via the unsubscribe link in our emails or by contacting us.',
      'Account Closure: You may close your account at any time by contacting our customer-care team.',
      'To exercise any of these rights, please contact us at info@jkrinternational.com. We will respond to your request within 30 days.',
    ],
  },
  {
    title: '7. Children\'s Privacy',
    body: [
      'Our website and services are not directed to children under the age of 18, and we do not knowingly collect personal information from children.',
      'If you believe we have collected information from a child in violation of this policy, please contact us immediately, and we will take steps to delete such information.',
    ],
  },
  {
    title: '8. Changes to This Policy',
    body: [
      'We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or operational reasons. The "Last Updated" date at the top of this page indicates the most recent revision.',
      'We encourage you to review this policy periodically. Material changes will be communicated via email or a prominent notice on our website. Continued use of our services after any changes constitutes your acceptance of the revised policy.',
    ],
  },
  {
    title: '9. Contact',
    body: [
      'If you have any questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact our Data Protection Officer using the details below:',
      'Email: info@jkrinternational.com',
      'Phone (Dubai): +971 4 123 4567',
      'Phone (Abu Dhabi): +971 2 765 4321',
      'WhatsApp: +971 50 123 4567',
      'Address: Office 1201, Business Bay Tower, Business Bay, Dubai, UAE',
    ],
  },
]

export function PrivacyView() {
  const { navigate } = useStore()

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-4xl font-bold md:text-5xl">Privacy Policy</h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/85">
            Your privacy matters to us. Learn how we collect, use, and protect your personal
            information.
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
                      href={`#${s.title.replace(/[.\s'\u2019]+/g, '-').toLowerCase()}`}
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
                  This Privacy Policy was last updated on{' '}
                  <strong>{LAST_UPDATED}</strong>. It describes how JKR International collects,
                  uses, and protects your personal information.
                </p>

                {SECTIONS.map((s) => (
                  <section
                    key={s.title}
                    id={s.title.replace(/[.\s'\u2019]+/g, '-').toLowerCase()}
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
                <h2 className="text-xl font-bold">Privacy Questions?</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/85">
                  If you have any questions about our privacy practices or wish to exercise your
                  data rights, please reach out.
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
