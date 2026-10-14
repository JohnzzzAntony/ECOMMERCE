import { storeMetadata, StoreRoutePage } from '../_storefront/store-route'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return (await storeMetadata({ kind: 'cart' })) ?? {}
}

export default function CartPage() {
  return <StoreRoutePage route={{ kind: 'cart' }} />
}
