import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export { cloudinary }

/**
 * Convert a Cloudinary public_id to a full URL with optional transforms.
 * e.g. getCloudinaryUrl('products/my-image_xyz') →
 *      'https://res.cloudinary.com/dkhblh1sr/image/upload/q_auto,f_auto/products/my-image_xyz'
 */
export function getCloudinaryUrl(
  publicId: string,
  options: {
    width?: number
    height?: number
    quality?: string
    format?: string
    crop?: string
  } = {}
): string {
  if (!publicId) return '/placeholder-product.png'

  // If it's already a full URL, return as-is
  if (publicId.startsWith('http')) return publicId

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dkhblh1sr'

  const transforms: string[] = ['q_auto', 'f_auto']
  if (options.width) transforms.push(`w_${options.width}`)
  if (options.height) transforms.push(`h_${options.height}`)
  if (options.crop) transforms.push(`c_${options.crop}`)

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms.join(',')}/${publicId}`
}

/**
 * Upload a file buffer or base64 string to Cloudinary.
 */
export async function uploadToCloudinary(
  file: string | Buffer,
  folder = 'products'
): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(
    typeof file === 'string' ? file : `data:image/jpeg;base64,${file.toString('base64')}`,
    {
      folder,
      resource_type: 'image',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    }
  )
  return { url: result.secure_url, publicId: result.public_id }
}

/**
 * Upload a theme asset (image, font, video, document) and return its public URL.
 * Non-image files are stored as `raw` with their extension so browsers get the right type.
 */
export async function uploadThemeAsset(data: Uint8Array, folder: string, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const resourceType = /^(png|jpe?g|gif|webp|svg|avif|ico|bmp)$/.test(ext) ? 'image' : /^(mp4|webm|ogv|mov)$/.test(ext) ? 'video' : 'raw'
  const base = filename.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 80) || 'asset'
  const id = `${base}-${Math.random().toString(36).slice(2, 8)}`
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, public_id: resourceType === 'raw' ? `${id}.${ext}` : id, overwrite: false },
      (error, res) => (error || !res ? reject(error ?? new Error('Upload failed')) : resolve(res)),
    ).end(Buffer.from(data))
  })
  return result.secure_url
}
