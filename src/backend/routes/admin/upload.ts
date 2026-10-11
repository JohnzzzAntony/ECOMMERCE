import { NextResponse } from 'next/server'
import { failure, HttpError, requireAdmin } from '@/backend/lib/auth'
import { uploadToCloudinary } from '@/backend/integrations/cloudinary'

const FOLDERS = ['products', 'blog', 'gallery', 'slides', 'testimonials', 'clients', 'categories', 'brands', 'themes', 'pages']
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded')
    if (!TYPES.includes(file.type)) throw new HttpError(400, 'Only JPG, PNG, WebP, GIF, AVIF or SVG images are allowed')
    if (file.size > MAX_BYTES) throw new HttpError(400, 'Image must be 10 MB or smaller')
    const folder = String(formData.get('folder') || 'products')
    if (!FOLDERS.includes(folder)) throw new HttpError(400, 'Invalid upload folder')

    const result = await uploadToCloudinary(Buffer.from(await file.arrayBuffer()), folder)
    return NextResponse.json({ ok: true, url: result.url, publicId: result.publicId })
  } catch (error) {
    if (error instanceof HttpError) return failure(error)
    console.error('Cloudinary upload error:', error)
    return NextResponse.json({ error: 'Image upload failed. Check the Cloudinary configuration.' }, { status: 502 })
  }
}
