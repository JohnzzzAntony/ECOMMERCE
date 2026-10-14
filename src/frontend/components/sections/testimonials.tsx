import { Container, Heading, SectionShell, SmartImage, grid, settingsOf, type SectionProps } from './shared'
import type { ImageValue } from '@/shared/sections/fields'

export default function Testimonials({ section }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; columns: number }>(section)
  const g = grid(s.columns)
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-8">
        {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl">{s.title}</Heading>}
        <ul className={g.className} style={g.style}>
          {section.blocks.map((b) => {
            const t = b.settings as { quote: string; author: string; role: string; avatar: ImageValue; rating: number }
            return (
              <li key={b.id}>
                <figure className="flex h-full flex-col gap-4 rounded-[var(--radius-3,12px)] border border-current/10 p-6">
                  {t.rating > 0 && <p aria-label={`${t.rating} out of 5 stars`} className="tracking-widest" style={{ color: 'var(--color-primary, #E8A100)' }}>{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</p>}
                  <blockquote className="flex-1 whitespace-pre-line leading-relaxed">{t.quote}</blockquote>
                  {(t.author || t.avatar) && (
                    <figcaption className="flex items-center gap-3 text-sm">
                      {t.avatar && <SmartImage image={{ ...t.avatar, decorative: true }} sizes="48px" className="size-12 rounded-full object-cover" />}
                      <span><span className="font-semibold">{t.author}</span>{t.role && <span className="block opacity-70">{t.role}</span>}</span>
                    </figcaption>
                  )}
                </figure>
              </li>
            )
          })}
        </ul>
      </Container>
    </SectionShell>
  )
}
