// Formatting helpers for JKR International

export function formatAED(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' AED'
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-AE').format(amount)
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
