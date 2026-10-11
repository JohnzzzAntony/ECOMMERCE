/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test'
import { slugify } from '../src/backend/lib/slug'
import { effectivePrice, formatAED, formatNumber } from '../src/frontend/lib/format'

describe('catalog behavior preserved by cleanup', () => {
  test.each([
    ['  Medical Equipment  ', 'medical-equipment'],
    ['A__B -- C', 'a-b-c'],
    ['Wheelchair & Accessories!', 'wheelchair-accessories'],
    ['SKU_123', 'sku-123'],
    ['', ''],
  ])('slug: %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  test('AED and number formatting retain locale and rounding', () => {
    for (const value of [0, 1, 1.5, -1.5, 1234.56, 1000000]) {
      expect(formatAED(value)).toBe(new Intl.NumberFormat('en-AE', {
        style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(value) + ' AED')
      expect(formatNumber(value)).toBe(new Intl.NumberFormat('en-AE').format(value))
    }
  })

  test('sale price retains existing null and zero behavior', () => {
    expect(effectivePrice({ onSale: true, salePrice: 80, regularPrice: 100 })).toBe(80)
    expect(effectivePrice({ onSale: false, salePrice: 80, regularPrice: 100 })).toBe(100)
    expect(effectivePrice({ onSale: true, salePrice: null, regularPrice: 100 })).toBe(100)
    expect(effectivePrice({ onSale: true, salePrice: 0, regularPrice: 100 })).toBe(100)
  })
})
