// Native <details>: accessible and interactive without any JavaScript.
import { Container, Heading, RichTextView, SectionShell, settingsOf, type SectionProps } from './shared'
import type { RichText } from '@/shared/sections/fields'

export default function Faq({ section }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string }>(section)
  return (
    <SectionShell section={section}>
      <Container section={section} className="max-w-3xl space-y-8">
        {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl">{s.title}</Heading>}
        <div className="divide-y divide-current/10 border-y border-current/10">
          {section.blocks.map((b) => {
            const q = b.settings as { question: string; answer: RichText }
            return (
              <details key={b.id} className="group py-2">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 font-medium">
                  {q.question}
                  <span aria-hidden className="text-xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <RichTextView value={q.answer} className="pb-4 leading-relaxed opacity-90" />
              </details>
            )
          })}
        </div>
      </Container>
    </SectionShell>
  )
}
