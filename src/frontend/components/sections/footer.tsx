import { Container, RichTextView, SectionShell, SmartImage, SmartLink, settingsOf, type SectionProps } from './shared'
import type { ImageValue, LinkValue, RichText } from '@/shared/sections/fields'

export default function Footer({ section, page }: SectionProps) {
  const s = settingsOf<{ logo: ImageValue; about: RichText; copyright: string }>(section)
  return (
    <SectionShell section={section} as="footer" className="text-sm" style={{ background: section.settings.background ? undefined : 'var(--color-footer, #111827)', color: section.settings.textColor ? undefined : 'var(--color-on-footer, #e5e7eb)' }}>
      <Container section={section}>
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(auto-fit,minmax(140px,1fr))]">
          <div className="space-y-4">
            {s.logo ? <SmartImage image={s.logo} className="max-h-12 w-auto" sizes="200px" /> : <div className="text-lg font-bold">{page.store.name}</div>}
            <RichTextView value={s.about} className="max-w-sm opacity-80" />
          </div>
          {section.blocks.map((b) => {
            const col = b.settings as { title: string; links: { label: string; link: LinkValue }[] }
            return (
              <nav key={b.id} aria-label={col.title || 'Footer links'}>
                {col.title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">{col.title}</h2>}
                <ul className="space-y-2">{col.links.map((l, i) => <li key={i}><SmartLink link={l.link} className="opacity-80 hover:underline hover:opacity-100">{l.label}</SmartLink></li>)}</ul>
              </nav>
            )
          })}
        </div>
        {s.copyright && <p className="mt-10 border-t border-current/10 pt-6 opacity-70">{s.copyright}</p>}
      </Container>
    </SectionShell>
  )
}
