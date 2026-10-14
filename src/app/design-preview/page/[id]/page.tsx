// Draft preview for the admin page editor (iframe). Access needs a short-lived token bound to this store + page.
import { notFound } from 'next/navigation'
import { storeForHost } from '@/backend/lib/store'
import { storeDb } from '@/backend/lib/tenancy'
import { verifyPreviewToken } from '@/backend/lib/preview-token'
import { renderPreview } from '@/backend/lib/storefront'
import { PreviewClient } from '@/frontend/components/sections/preview-client'
import type { StorePageType } from '@/shared/store-pages'
import { requestOrigin } from '../../../_storefront/store-route'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }

export default async function PagePreview({ params, searchParams }: Props) {
  const [{ id }, { token }, { host }] = await Promise.all([params, searchParams, requestOrigin()])
  const store = await storeForHost(host)
  if (!verifyPreviewToken(token, { storeId: store.id, kind: 'page', id })) notFound()
  const sdb = storeDb(store.id)
  const page = await sdb.storePage.findFirst({ where: { id } })
  if (!page) notFound()
  const version = (await sdb.storePageVersion.findFirst({ where: { pageId: id, status: 'DRAFT' } }))
    ?? (page.publishedVersionId ? await sdb.storePageVersion.findFirst({ where: { id: page.publishedVersionId } }) : null)
  const rendered = await renderPreview(store.id, page.type as StorePageType, version?.sections ?? [], page.title)
  return <PreviewClient initial={rendered} dataUrl={`/api/design/pages/${id}/preview-data`} />
}
