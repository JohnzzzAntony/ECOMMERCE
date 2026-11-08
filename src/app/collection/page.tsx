import { notFound } from 'next/navigation'
import { loadOmbrineTheme, OmbrineRoute } from '../_storefront/ombrine-route'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'The collection | NexEcoms' }

export default async function Collection({ searchParams }: { searchParams: Promise<{ q?: string; brand?: string; page?: string; sale?: string; sort?: string }> }) {
  const [theme, { q, brand, page, sale, sort }] = await Promise.all([loadOmbrineTheme(), searchParams])
  if (!theme) notFound()
  return <OmbrineRoute theme={theme} route={{ kind: 'collection', slug: 'all', q: typeof q === 'string' ? q : undefined, brand, page: Number(page), sale: sale === '1', sort }} />
}
