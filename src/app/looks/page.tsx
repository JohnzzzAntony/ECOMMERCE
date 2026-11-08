import Link from 'next/link'
import { notFound } from 'next/navigation'
import { salonLooks } from '@/backend/lib/ombrine'
import { OmbrineShell } from '@/frontend/components/theme/ombrine-shell'
import { LOOK_AUDIENCES, salonCurrency, salonPrice } from '@/shared/ombrine'
import { effectivePrice } from '@/shared/storefront'
import { loadOmbrineTheme, OmbrineIndexHeading } from '../_storefront/ombrine-route'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'The looks | Ombrine' }

export default async function Looks({ searchParams }: { searchParams: Promise<{ audience?: string }> }) {
  const [theme, { audience }] = await Promise.all([loadOmbrineTheme(), searchParams])
  if (!theme) notFound()
  const looks = await salonLooks(theme)
  const filter = LOOK_AUDIENCES.find((value) => value === audience)
  const cards = looks.map((look, index) => ({ look, index })).filter(({ look }) => !filter || look.audience === filter)
  const pieces = looks.reduce((sum, look) => sum + look.products.length, 0)
  return <OmbrineShell theme={theme}>
    <section className="om-index">
      <OmbrineIndexHeading title="The looks" summary={`${looks.length} ${looks.length === 1 ? 'look' : 'looks'}, ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`} theme={theme} />
      <div className="om-index-bar om-looks-filter">
        <nav aria-label="Filter looks"><Link href="/looks" aria-current={!filter ? 'page' : undefined}>All</Link>
          {LOOK_AUDIENCES.map((value) => <Link key={value} href={`/looks?audience=${value}`} aria-current={filter === value ? 'page' : undefined}>{value === 'women' ? 'Women' : 'Men'}</Link>)}
        </nav>
        <span className="om-muted">{cards.length} {cards.length === 1 ? 'look' : 'looks'}</span>
      </div>
      <div className="om-index-grid">
        {!cards.length && <p>No looks in this selection.</p>}
        <div className="om-looks-grid">{cards.map(({ look, index }) => <article key={look.id} className="om-look-card">
          <Link href={`/looks/${encodeURIComponent(look.id)}`}>
            <div className="om-product-image"><img src={look.imageUrl} alt="" loading={index < 4 ? 'eager' : 'lazy'} /></div>
            <div className="om-look-card-title"><h2>{look.name}</h2><span>L{String(index + 1).padStart(2, '0')}</span></div>
            {look.description && <p className="om-muted">{look.description}</p>}
            <p>{salonPrice(look.products.reduce((sum, piece) => sum + effectivePrice(piece), 0), salonCurrency(theme))} · {look.products.length} {look.products.length === 1 ? 'piece' : 'pieces'}</p>
          </Link>
        </article>)}</div>
        <div className="om-look-index-footer"><h2>Prefer to shop piece by piece?</h2><Link className="om-link" href="/collection">See the collection →</Link></div>
      </div>
    </section>
  </OmbrineShell>
}
