import { storeMetadata, StoreRoutePage } from '../../_storefront/store-route'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  return (await storeMetadata({ kind: 'product', slug: decodeURIComponent((await params).slug) })) ?? {}
}

export default async function ProductPage({ params }: Props) {
  return <StoreRoutePage route={{ kind: 'product', slug: decodeURIComponent((await params).slug) }} />
}
