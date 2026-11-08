import { StoreRoutePage, storeMetadata } from '../_storefront/store-route'

export const dynamic = 'force-dynamic'
const route = { kind: 'page', slug: 'ombrine-journal' } as const

export function generateMetadata() { return storeMetadata(route) }
export default function EditorialPage() { return <StoreRoutePage route={route} /> }
