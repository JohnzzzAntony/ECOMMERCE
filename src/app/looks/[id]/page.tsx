import { notFound } from 'next/navigation'
import { loadOmbrineTheme } from '../../_storefront/ombrine-route'
import { salonLooks } from '@/backend/lib/ombrine'
import { OmbrineHome } from '@/frontend/components/theme/ombrine-salon'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const theme = await loadOmbrineTheme()
  const id = (await params).id
  const look = theme && (await salonLooks(theme)).find((item) => item.id === id)
  return look ? { title: look.name, description: look.description || undefined } : {}
}

export default async function LookPage({ params }: Props) {
  const theme = await loadOmbrineTheme()
  if (!theme) notFound()
  const id = (await params).id
  const looks = await salonLooks(theme)
  if (!looks.some((look) => look.id === id)) notFound()
  return <OmbrineHome key={id} theme={theme} initialLooks={looks} lookId={id} />
}
