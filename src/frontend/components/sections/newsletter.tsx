'use client'
import { useState } from 'react'
import { api } from '@/frontend/lib/api'
import { Container, Heading, RichTextView, SectionShell, settingsOf, type SectionProps } from './shared'
import type { RichText } from '@/shared/sections/fields'

export default function Newsletter({ section }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; body: RichText; placeholder: string; buttonLabel: string; successMessage: string; align: string }>(section)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    try { await api.newsletter(email.trim()); setState('done') } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); setState('error') }
  }
  const id = `nl-${section.id}`
  return (
    <SectionShell section={section}>
      <Container section={section} className="max-w-2xl space-y-4">
        {s.title && <Heading level={s.headingLevel} className="text-3xl">{s.title}</Heading>}
        <RichTextView value={s.body} className="opacity-80" />
        {state === 'done' ? <p role="status" className="font-medium">{s.successMessage}</p> : (
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row" style={{ justifyContent: s.align === 'center' ? 'center' : undefined }}>
            <label htmlFor={id} className="sr-only">Email address</label>
            <input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={s.placeholder} className="h-11 flex-1 rounded-[var(--radius-2,8px)] border border-current/20 bg-transparent px-4" />
            <button type="submit" disabled={state === 'sending'} className="min-h-11 rounded-[var(--radius-2,8px)] px-6 font-semibold hover:opacity-90 disabled:opacity-60" style={{ background: 'var(--color-primary, #0D6B8C)', color: 'var(--color-on-primary, #fff)' }}>{s.buttonLabel}</button>
          </form>
        )}
        {state === 'error' && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </Container>
    </SectionShell>
  )
}
