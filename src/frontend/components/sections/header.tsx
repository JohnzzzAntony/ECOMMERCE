import { Container, SectionShell, SmartImage, settingsOf, type SectionProps } from './shared'
import { CartLink, MobileMenu, SearchBox } from './header-client'
import { linkHref } from '@/shared/store-pages'
import type { ImageValue, LinkValue } from '@/shared/sections/fields'

export default function Header({ section, page }: SectionProps) {
  const s = settingsOf<{ logo: ImageValue; logoText: string; menu: { label: string; link: LinkValue }[]; showSearch: boolean; showCart: boolean; sticky: boolean }>(section)
  const name = s.logoText || page.store.name
  return (
    <SectionShell section={section} as="header" className={`${s.sticky ? 'sticky top-0 z-30' : ''} border-b border-black/5`} style={{ background: section.settings.background ? undefined : 'var(--color-background, #fff)' }}>
      <Container section={section} className="flex items-center gap-4">
        <MobileMenu menu={s.menu} />
        <a href="/" className="flex min-h-11 items-center gap-2 font-bold" aria-label={`${name} – home`}>
          {s.logo ? <SmartImage image={{ ...s.logo, alt: '', decorative: true }} className="max-h-10 w-auto" sizes="200px" priority /> : <span className="text-lg">{name}</span>}
        </a>
        <nav aria-label="Main" className="hidden flex-1 lg:block">
          <ul className="flex flex-wrap items-center justify-center gap-1">
            {s.menu.map((m, i) => <li key={i}><a href={linkHref(m.link) ?? '#'} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-black/5">{m.label}</a></li>)}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          {s.showSearch && <SearchBox />}
          {s.showCart && <CartLink />}
        </div>
      </Container>
    </SectionShell>
  )
}
