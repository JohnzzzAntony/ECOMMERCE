import { storeMetadata, StoreRoutePage } from '../../_storefront/store-route'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string | string[] }> }

const query = async (searchParams: Props['searchParams']) => { const q = (await searchParams).q; return typeof q === 'string' ? q : undefined }

export async function generateMetadata({ params, searchParams }: Props) {
  return (await storeMetadata({ kind: 'collection', slug: decodeURIComponent((await params).slug), q: await query(searchParams) })) ?? {}
}

export default async function CollectionPage({ params, searchParams }: Props) {
  return <StoreRoutePage route={{ kind: 'collection', slug: decodeURIComponent((await params).slug), q: await query(searchParams) }} />
}
