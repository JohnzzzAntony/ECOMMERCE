// Design tokens from the IR: named Figma styles first ("Brand/Primary"), then observed raw values, deduplicated
// and clustered (colours by ΔE in CIELAB, spacing/radius snapped to a scale). Pure: no I/O.
import { cssColor, walkIR, type IRColor, type IRDocument, type IRNode, type IRWarning } from '@/shared/design-ir'
import { contrastRatio, passesAA, type DesignTokens } from '@/shared/design-tokens'
import googleFonts from './google-fonts.json'

type Rgb = { r: number; g: number; b: number }

// ---- colour distance (CIE76 ΔE on CIELAB, D65) ----
function toLab({ r, g, b }: Rgb) {
  const lin = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return { L: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) }
}
export function deltaE(c1: Rgb, c2: Rgb) {
  const a = toLab(c1), b = toLab(c2)
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b)
}
export const COLOR_MERGE_DELTA_E = 3

const hex = (c: IRColor) => cssColor({ ...c, a: 1 })
const saturation = ({ r, g, b }: Rgb) => { const max = Math.max(r, g, b), min = Math.min(r, g, b); return max === 0 ? 0 : (max - min) / max }

type ColorUse = { value: string; rgb: Rgb; name?: string; usage: number; text: number; area: number }

export function snap(values: number[], step: number, max: number) {
  const counts = new Map<number, number>()
  for (const v of values) if (v > 0) { const s = Math.max(step, Math.round(v / step) * step); counts.set(s, (counts.get(s) ?? 0) + 1) }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([v]) => v).sort((a, b) => a - b)
}

// ---- fonts ----
const GOOGLE = new Map((googleFonts as [string, string, string][]).map(([family, cat, weights]) => [family.toLowerCase(), { family, cat, weights: weights.split(',').map(Number) }]))
const FALLBACK: Record<string, string> = { s: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', r: 'Georgia, "Times New Roman", serif', d: 'system-ui, sans-serif', h: 'cursive', m: 'ui-monospace, SFMono-Regular, Menlo, monospace' }

export function matchGoogleFont(family: string) {
  return GOOGLE.get(family.toLowerCase().trim()) ?? null
}
export function fallbackStack(family: string) {
  const g = matchGoogleFont(family)
  if (g) return FALLBACK[g.cat] ?? FALLBACK.s
  return /serif/i.test(family) && !/sans/i.test(family) ? FALLBACK.r : /mono|code/i.test(family) ? FALLBACK.m : FALLBACK.s
}

/** Nearest solid background behind a node (walks up the ancestors). */
function backgroundOf(chain: IRNode[]): Rgb | null {
  for (let i = chain.length - 1; i >= 0; i--) {
    const solid = chain[i].fills.find((f) => f.type === 'solid')
    if (solid && solid.type === 'solid' && solid.color.a >= 0.9) return solid.color
    if (chain[i].fills.some((f) => f.type === 'image' || f.type.endsWith('gradient'))) return null
  }
  return { r: 255, g: 255, b: 255 }
}

export function extractTokens(doc: IRDocument): { tokens: DesignTokens; warnings: IRWarning[] } {
  const colors: ColorUse[] = []
  const typo = new Map<string, { name?: string; family: string; size: number; weight: number; lineHeight: number | null; letterSpacing: number; italic: boolean; usage: number }>()
  const spacing: number[] = [], radii: number[] = [], shadowSet = new Map<string, number>()
  const warnings: IRWarning[] = []
  const contrastSeen = new Set<string>()

  const addColor = (c: IRColor, name: string | undefined, kind: 'text' | 'area', weight = 1) => {
    if (c.a < 0.05) return
    const value = hex(c)
    let entry = colors.find((x) => x.value === value && x.name === name)
    if (!entry) { entry = { value, rgb: c, name, usage: 0, text: 0, area: 0 }; colors.push(entry) }
    entry.usage += weight; entry[kind] += weight
  }

  const frameFills = new Map<string, { rgb: Rgb; n: number }>()
  for (const page of doc.pages) {
    for (const frame of page.frames) {
      const fill = backgroundOf([frame.root]) ?? { r: 255, g: 255, b: 255 }
      const f = frameFills.get(hex({ ...fill, a: 1 })) ?? { rgb: fill, n: 0 }
      f.n++; frameFills.set(hex({ ...fill, a: 1 }), f)
      const chain: IRNode[] = []
      const visit = (n: IRNode) => {
        chain.push(n)
        for (const f of n.fills) if (f.type === 'solid') addColor(f.color, f.styleName, 'area', Math.max(1, Math.round((n.width * n.height) / 10000)))
        if (n.layout) { spacing.push(n.layout.gap, ...n.layout.padding) }
        if (n.radius) radii.push(...n.radius.filter((r) => r > 0 && r < 999))
        for (const s of n.shadows) {
          const v = `${s.inset ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${hex(s.color)}`
          shadowSet.set(v, (shadowSet.get(v) ?? 0) + 1)
        }
        if (n.text) {
          const st = n.text.style
          if (st.color) addColor(st.color, undefined, 'text')
          const key = st.styleName ?? `${st.fontFamily}|${st.fontSize}|${st.fontWeight}|${st.lineHeight}|${st.letterSpacing}|${st.italic}`
          const t = typo.get(key) ?? { name: st.styleName, family: st.fontFamily, size: st.fontSize, weight: st.fontWeight, lineHeight: st.lineHeight, letterSpacing: st.letterSpacing, italic: st.italic, usage: 0 }
          t.usage++; typo.set(key, t)
          const bg = st.color && backgroundOf(chain.slice(0, -1))
          if (st.color && bg && n.text.runs.some((r) => r.text.trim())) {
            const ratio = contrastRatio(st.color, bg)
            if (!passesAA(ratio, st.fontSize, st.fontWeight) && !contrastSeen.has(n.id)) {
              contrastSeen.add(n.id)
              warnings.push({ code: 'LOW_CONTRAST', nodeId: n.id, pageTitle: page.title, message: `Text “${n.name}” has contrast ${ratio.toFixed(2)}:1 (${hex(st.color)} on ${hex({ ...bg, a: 1 })}); WCAG AA needs ${st.fontSize >= 24 ? '3' : '4.5'}:1.` })
            }
          }
        }
        n.children.forEach(visit)
        chain.pop()
      }
      visit(frame.root)
    }
  }

  // Cluster near-identical observed colours into the most used one; named styles are kept as they are.
  colors.sort((a, b) => (b.name ? 1 : 0) - (a.name ? 1 : 0) || b.usage - a.usage)
  const kept: ColorUse[] = []
  for (const c of colors) {
    const twin = kept.find((k) => (!c.name || k.name === c.name) && deltaE(k.rgb, c.rgb) < COLOR_MERGE_DELTA_E && (!k.name || !c.name))
    if (twin && !c.name) { twin.usage += c.usage; twin.text += c.text; twin.area += c.area } else kept.push(c)
  }
  const named = kept.filter((c) => c.name)
  const observed = kept.filter((c) => !c.name).sort((a, b) => b.usage - a.usage)
  const roles = new Map<ColorUse, string>()
  // The storefront paints the page with Background/Text, so they come from the page frames' own fill (not the
  // largest dark area, e.g. a footer) and the most used text colour that is readable on it.
  const pageBg = [...frameFills.values()].sort((a, b) => b.n - a.n)[0]?.rgb ?? { r: 255, g: 255, b: 255 }
  const pageText = kept.filter((c) => c.text && passesAA(contrastRatio(c.rgb, pageBg))).sort((a, b) => b.text - a.text)[0]
  const roleTokens = [
    { name: 'Background', value: hex({ ...pageBg, a: 1 }), source: 'observed' as const, usage: 0 },
    ...(pageText ? [{ name: 'Text', value: pageText.value, source: 'observed' as const, usage: pageText.text }] : []),
  ]
  const accent = observed.filter((c) => saturation(c.rgb) > 0.35).sort((a, b) => b.usage - a.usage)[0]
  if (accent) roles.set(accent, 'Primary')
  let n = 1
  const colorTokens = [
    ...named.map((c) => ({ name: c.name!, value: c.value, source: 'style' as const, usage: c.usage })),
    ...roleTokens,
    ...observed.slice(0, 24).map((c) => ({ name: roles.get(c) ?? `Color ${n++}`, value: c.value, source: 'observed' as const, usage: c.usage })),
  ]
  const seenNames = new Set<string>()
  const colorsUnique = colorTokens.filter((c) => (seenNames.has(c.name.toLowerCase()) ? false : (seenNames.add(c.name.toLowerCase()), true))).slice(0, 80)

  // Typography: named text styles, then the most used observed combinations.
  const typoList = [...typo.values()].sort((a, b) => (b.name ? 1 : 0) - (a.name ? 1 : 0) || b.size - a.size || b.usage - a.usage)
  const typography: DesignTokens['typography'] = []
  let h = 1
  const typoNames = new Set<string>()
  for (const t of typoList) {
    if (typography.length >= 16) break
    if (!t.name && t.usage < 1) continue
    let name = t.name ?? (t.size >= 24 ? `Heading ${h++}` : t.size >= 15 ? 'Body' : 'Small')
    if (typoNames.has(name.toLowerCase())) { if (!t.name) continue; name = `${name} ${typography.length}` }
    typoNames.add(name.toLowerCase())
    typography.push({ name: name.slice(0, 60), family: t.family, size: t.size, weight: t.weight, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing, italic: t.italic })
  }

  const widths = doc.pages.flatMap((p) => p.frames)
  const tabletWidths = widths.filter((f) => f.device === 'tablet').map((f) => f.root.width)
  const desktopFrames = widths.filter((f) => f.device === 'desktop')
  const contentWidth = desktopFrames.map((f) => {
    const inner = f.root.children.flatMap((c) => c.children).filter((c) => c.widthMode === 'fixed' && c.width < f.root.width - 40).map((c) => c.width)
    return inner.length ? Math.max(...inner) : f.root.width - (f.root.layout?.padding[1] ?? 0) - (f.root.layout?.padding[3] ?? 0)
  })

  const tokens: DesignTokens = {
    colors: colorsUnique.map((c) => ({ ...c, name: c.name.replace(/[^A-Za-z0-9 _/&().-]/g, '').slice(0, 60) || 'Color' })),
    typography: typography.map((t) => ({ ...t, family: t.family.replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 60) || 'Inter', name: t.name.replace(/[^A-Za-z0-9 _/&().-]/g, '') || 'Text' })),
    spacing: snap(spacing, 4, 12),
    radius: snap(radii, 2, 8),
    shadows: [...shadowSet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([value], i) => ({ name: `Shadow ${i + 1}`, value })),
    breakpoints: { tablet: tabletWidths.length ? Math.min(...tabletWidths) : 768, desktop: 1200 },
    container: Math.min(4000, Math.max(320, Math.round(contentWidth.length ? Math.max(...contentWidth) : 1200))),
    fonts: doc.fonts.slice(0, 12).map((f) => ({ family: f.family.replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 60) || 'Inter', fallback: fallbackStack(f.family) })),
  }
  for (const f of doc.fonts) {
    if (!matchGoogleFont(f.family)) warnings.push({ code: 'MISSING_FONT', message: `Font “${f.family}” is not a Google Font. Upload its font files (you must hold a web licence); until then ${fallbackStack(f.family).split(',')[0]} is used.` })
  }
  return { tokens, warnings }
}
