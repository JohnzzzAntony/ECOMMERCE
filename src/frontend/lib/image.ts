// Ask image CDNs for a resized copy instead of the full original (product cards, thumbnails).
// Other hosts are returned unchanged.
export function sizedImage(url: string | null | undefined, width: number): string {
  if (!url) return ''
  // Cloudinary: insert a transformation after /image/upload/ unless one is already there.
  const cld = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!(?:[a-z]{1,3}_[^/,]+,?)+\/)(.*)$/.exec(url)
  if (cld) return `${cld[1]}w_${width},c_limit,q_auto,f_auto/${cld[2]}`
  // Shopify CDN accepts a width parameter.
  if (/^https:\/\/cdn\.shopify\.com\//.test(url)) return `${url}${url.includes('?') ? '&' : '?'}width=${width}`
  return url
}
