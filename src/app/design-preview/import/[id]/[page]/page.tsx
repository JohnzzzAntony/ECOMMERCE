// Preview of one mapped page of an import under review (iframe in the review screen).
import { notFound } from 'next/navigation'
import { storeForHost } from '@/backend/lib/store'
import { storeDb } from '@/backend/lib/tenancy'
import { verifyPreviewToken } from '@/backend/lib/preview-token'
import { renderPreview } from '@/backend/lib/storefront'
import type { ImportResult } from '@/backend/lib/design-import/pipeline'
import { PreviewClient } from '@/frontend/components/sections/preview-client'
import type { StorePageType } from '@/shared/store-pages'
import { IR_KEYS } from '@/shared/design-ir'
import { requestOrigin } from '../../../../_storefront/store-route'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }
type Props = { params: Promise<{ id: string; page: string }>; searchParams: Promise<{ token?: string }> }

/** Pending (unresolved) image references render as empty images. */
const dropPending = (v: unknown): unknown => Array.isArray(v) ? v.map(dropPending) : v && typeof v === 'object'
  ? (typeof (v as { url?: unknown }).url === 'string' && String((v as { url: string }).url).startsWith('pending:') ? null : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, IR_KEYS.has(k) ? x : dropPending(x)])))
  : v

export default async function ImportPreview({ params, searchParams }: Props) {
  const [{ id, page }, { token }, { host }] = await Promise.all([params, searchParams, requestOrigin()])
  const store = await storeForHost(host)
  if (!verifyPreviewToken(token, { storeId: store.id, kind: 'import', id })) notFound()
  const job = await storeDb(store.id).designImport.findFirst({ where: { id } })
  const mapped = ((job?.result ?? {}) as ImportResult).pages?.[Number(page)]
  if (!mapped) notFound()
  const rendered = await renderPreview(store.id, mapped.type as StorePageType, dropPending(mapped.sections), mapped.title)
  return <PreviewClient initial={rendered} dataUrl="" />
}
