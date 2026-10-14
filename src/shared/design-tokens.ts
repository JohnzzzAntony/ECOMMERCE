// Store design system: tokens extracted from Figma (editable by admins), rendered as CSS custom properties.
// Values are validated strictly because they are written into a <style> element on the storefront.
import { z } from 'zod'

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i
const NAME = /^[A-Za-z0-9 _/&().-]{1,60}$/
const FONT_FAMILY = /^[A-Za-z0-9 _-]{1,60}$/

export const colorTokenSchema = z.object({ name: z.string().regex(NAME), value: z.string().regex(HEX), source: z.enum(['style', 'observed']).default('observed'), usage: z.number().int().min(0).default(0) })
export const typographyTokenSchema = z.object({
  name: z.string().regex(NAME),
  family: z.string().regex(FONT_FAMILY),
  size: z.number().min(6).max(400),
  weight: z.number().int().min(100).max(950),
  lineHeight: z.number().min(0).max(800).nullable(),
  letterSpacing: z.number().min(-50).max(50),
  italic: z.boolean().default(false),
})
export const designTokensSchema = z.object({
  colors: z.array(colorTokenSchema).max(80),
  typography: z.array(typographyTokenSchema).max(40),
  spacing: z.array(z.number().min(0).max(800)).max(24),
  radius: z.array(z.number().min(0).max(1000)).max(12),
  shadows: z.array(z.object({ name: z.string().regex(NAME), value: z.string().regex(/^(inset )?-?\d+(\.\d+)?px -?\d+(\.\d+)?px \d+(\.\d+)?px -?\d+(\.\d+)?px #[0-9a-f]{6}([0-9a-f]{2})?$/i) })).max(12),
  breakpoints: z.object({ tablet: z.number().int().min(320).max(4000), desktop: z.number().int().min(320).max(4000) }),
  container: z.number().int().min(320).max(4000),
  fonts: z.array(z.object({ family: z.string().regex(FONT_FAMILY), fallback: z.string().regex(/^[A-Za-z0-9 ,'"-]{1,120}$/) })).max(12),
})
export type DesignTokens = z.infer<typeof designTokensSchema>
export type ColorToken = DesignTokens['colors'][number]
export type TypographyToken = DesignTokens['typography'][number]

export const EMPTY_TOKENS: DesignTokens = {
  colors: [], typography: [], spacing: [], radius: [], shadows: [], breakpoints: { tablet: 768, desktop: 1200 }, container: 1200, fonts: [],
}

export const tokenSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'token'

const familyStack = (tokens: DesignTokens, family: string) => {
  const f = tokens.fonts.find((x) => x.family === family)
  return `"${family}", ${f?.fallback ?? 'system-ui, sans-serif'}`
}

/** CSS custom properties for the storefront: --color-*, --font-*, --space-*, --radius-*, --shadow-*, --container. */
export function tokensCss(tokens: DesignTokens, selector = ':root') {
  const lines: string[] = []
  const used = new Set<string>()
  const add = (name: string, value: string) => { if (!used.has(name)) { used.add(name); lines.push(`${name}:${value}`) } }
  for (const c of tokens.colors) add(`--color-${tokenSlug(c.name)}`, c.value)
  for (const t of tokens.typography) {
    const s = tokenSlug(t.name)
    add(`--font-${s}-family`, familyStack(tokens, t.family))
    add(`--font-${s}-size`, `${t.size}px`)
    add(`--font-${s}-weight`, String(t.weight))
    add(`--font-${s}-line-height`, t.lineHeight ? `${t.lineHeight}px` : 'normal')
    add(`--font-${s}-letter-spacing`, `${t.letterSpacing}px`)
  }
  tokens.spacing.forEach((v, i) => add(`--space-${i + 1}`, `${v}px`))
  tokens.radius.forEach((v, i) => add(`--radius-${i + 1}`, `${v}px`))
  for (const sh of tokens.shadows) add(`--shadow-${tokenSlug(sh.name)}`, sh.value)
  add('--container', `${tokens.container}px`)
  add('--breakpoint-tablet', `${tokens.breakpoints.tablet}px`)
  add('--breakpoint-desktop', `${tokens.breakpoints.desktop}px`)
  const body = tokens.typography[0] ? `body{font-family:var(--font-${tokenSlug(tokens.typography.find((t) => /body|paragraph|text/i.test(t.name))?.name ?? tokens.typography[0].name)}-family)}` : ''
  return `${selector}{${lines.join(';')}}${body}`
}

// ---- WCAG contrast ----
export function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}
const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
export const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
export function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** WCAG 2.x AA: 4.5:1 for normal text, 3:1 for large text (≥24px, or ≥18.66px bold). */
export function passesAA(ratio: number, fontSize = 16, fontWeight = 400) {
  const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)
  return ratio >= (large ? 3 : 4.5)
}

/** Text/background colour pairs to check: every "text"-like colour token against every "background"-like one. */
export function contrastIssues(tokens: DesignTokens) {
  const isText = (n: string) => /text|ink|foreground|fg|heading|body|on-/i.test(n)
  const isBg = (n: string) => /background|bg|surface|canvas|base|paper|white|primary|brand/i.test(n) && !isText(n)
  const issues: { text: string; background: string; ratio: number }[] = []
  for (const t of tokens.colors.filter((c) => isText(c.name))) {
    for (const b of tokens.colors.filter((c) => isBg(c.name))) {
      const ratio = contrastRatio(hexToRgb(t.value), hexToRgb(b.value))
      if (!passesAA(ratio)) issues.push({ text: t.name, background: b.name, ratio: +ratio.toFixed(2) })
    }
  }
  return issues
}
