// Formatting helpers for NexEcoms

const aedFormatter = new Intl.NumberFormat('en-AE', {
  style: 'decimal',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const numberFormatter = new Intl.NumberFormat('en-AE')

export function formatAED(amount: number): string {
  return aedFormatter.format(amount) + ' AED'
}

export function formatNumber(amount: number): string {
  return numberFormatter.format(amount)
}

export function discountPercent(regular: number, sale: number): number {
  return Math.round(((regular - sale) / regular) * 100)
}

export function effectivePrice(p: { onSale: boolean; salePrice: number | null; regularPrice: number }): number {
  return p.onSale && p.salePrice ? p.salePrice : p.regularPrice
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
