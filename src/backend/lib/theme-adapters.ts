// Theme adapter registry: which kinds of theme the store can install, and how editable each one is.
//
// Compatibility levels (public/docs/theme-format.md):
//   A  native manifest (theme.json) — settings, sections, pages and menus are typed and validated.
//   B  framework source adapter — none is shipped: source projects are never built on the server.
//   C  rendered DOM — static HTML templates; pages are edited visually in an isolated frame.
//   D  unsupported — needs a runtime the store doesn't have (Liquid, PHP) or an unbuilt app source.
//
// To add a stack, add an adapter here (detect + capabilities) and a planner in theme-package.ts.
import { strFromU8 } from 'fflate'
import type { CompatLevel, ThemeReport } from '@/shared/theme'

export type Files = Map<string, Uint8Array>

export interface Detection {
  /** 0–1: how sure the adapter is that the package is its kind. */
  confidence: number
  /** Native: path of theme.json. HTML: folder holding the pages. */
  entry: string
  detected: string
}

export interface ThemeAdapter {
  id: string
  version: string
  level: CompatLevel
  label: string
  capabilities: string[]
  unsupported: string[]
  recommendations: string[]
  detect(files: Files): Detection | null
  /** Level D adapters: why the package can't be installed. */
  reject?: string
}

const ext = (path: string) => path.split('.').pop()?.toLowerCase() ?? ''
const base = (path: string) => path.split('/').pop() ?? ''
const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '')
const depth = (path: string) => path.split('/').length
const shallowest = (paths: string[]) => [...paths].sort((a, b) => depth(a) - depth(b))[0]
export const DOC_DIR = /(^|\/)(documentation|docs?|help|psd|source|sources|licen[cs]e)\//i
const head = (files: Files, path: string, n: number) => strFromU8(files.get(path)!.slice(0, n))

const nativeAdapter: ThemeAdapter = {
  id: 'native-manifest',
  version: '1.0.0',
  level: 'A',
  label: 'Native theme (theme.json)',
  capabilities: [
    'Theme settings: colors, fonts, spacing, images, links (typed, validated)',
    'Home page sections: add, duplicate, hide, reorder, remove, per-section style and animation',
    'Pages, menus and custom CSS',
    'Draft, publish and rollback',
  ],
  unsupported: [],
  recommendations: [],
  detect(files) {
    const manifest = shallowest([...files.keys()].filter((p) => base(p) === 'theme.json'))
    return manifest ? { confidence: 1, entry: manifest, detected: 'theme.json manifest' } : null
  },
}

const liquidAdapter: ThemeAdapter = {
  id: 'shopify-liquid',
  version: '1.0.0',
  level: 'D',
  label: 'Shopify Liquid theme',
  capabilities: [],
  unsupported: ['Liquid templates need Shopify’s servers to render'],
  recommendations: ['Upload the theme’s HTML version, or convert it to a theme.json package'],
  reject: 'This is a Shopify (Liquid) theme. It needs Shopify’s servers to run. Use the theme’s HTML version, or a native theme package (theme.json).',
  detect(files) {
    const paths = [...files.keys()]
    const layout = paths.some((p) => /(^|\/)layout\/theme\.liquid$/.test(p))
    const count = paths.filter((p) => ext(p) === 'liquid').length
    return layout || count > 3 ? { confidence: layout ? 0.95 : 0.8, entry: '', detected: 'Shopify Liquid' } : null
  },
}

const wordpressAdapter: ThemeAdapter = {
  id: 'wordpress-php',
  version: '1.0.0',
  level: 'D',
  label: 'WordPress theme',
  capabilities: [],
  unsupported: ['PHP templates need WordPress to render'],
  recommendations: ['Upload the theme’s HTML version, or convert it to a theme.json package'],
  reject: 'This is a WordPress theme. It needs PHP and WordPress to run. Use the theme’s HTML version, or a native theme package (theme.json).',
  detect(files) {
    const paths = [...files.keys()]
    const style = paths.some((p) => base(p) === 'style.css' && /Theme Name\s*:/i.test(head(files, p, 4000)))
    return style || paths.some((p) => base(p) === 'functions.php') ? { confidence: style ? 0.95 : 0.8, entry: '', detected: 'WordPress (PHP)' } : null
  },
}

const FRAMEWORKS: [RegExp, string][] = [
  [/"next"\s*:/, 'Next.js'], [/"nuxt"\s*:/, 'Nuxt'], [/"@angular\/core"\s*:/, 'Angular'], [/"svelte"\s*:/, 'Svelte'],
  [/"vue"\s*:/, 'Vue'], [/"react"\s*:/, 'React'], [/"astro"\s*:/, 'Astro'], [/"vite"\s*:/, 'Vite'],
]

/** Framework named by the shallowest package.json, if any. */
function framework(files: Files): string | null {
  const pkg = shallowest([...files.keys()].filter((p) => base(p) === 'package.json' && !/node_modules/.test(p)))
  if (!pkg) return null
  const json = head(files, pkg, 100_000)
  return FRAMEWORKS.find(([re]) => re.test(json))?.[1] ?? 'JavaScript app'
}

const builtHtml = (paths: string[]) => shallowest(paths.filter((p) => /(^|\/)(dist|build|out|www|public_html)\/(.*\/)?index\.html?$/i.test(p) && !/node_modules/.test(p)))

const sourceAppAdapter: ThemeAdapter = {
  id: 'app-source',
  version: '1.0.0',
  level: 'D',
  label: 'Unbuilt app source',
  capabilities: [],
  unsupported: ['Source projects are not built or run on the store server (untrusted install scripts)'],
  recommendations: ['Run the project’s build (npm run build) and upload a zip that includes the build folder (dist/, build/ or out/)'],
  reject: 'This is an app source project (package.json). Build it first (npm run build) and upload a zip that includes the build folder (dist/, build/ or out/).',
  detect(files) {
    const name = framework(files)
    if (!name) return null
    const paths = [...files.keys()]
    if (builtHtml(paths)) return null
    const renderable = paths.some((p) => /\.html?$/i.test(p) && /<body[\s\S]*<(header|nav|main|section|div class)/i.test(head(files, p, 200_000)))
    return renderable ? null : { confidence: 0.9, entry: '', detected: `${name} source` }
  },
}

const htmlAdapter: ThemeAdapter = {
  id: 'html-dom',
  version: '1.0.0',
  level: 'C',
  label: 'HTML template (rendered DOM)',
  capabilities: [
    'Pages render with their own CSS and scripts in an isolated frame',
    'Visual page editor: click text to edit, replace images, links, colors, font size, background',
    'Duplicate, move and remove elements',
    'CSS :root variables become theme settings',
    'Menus extracted from the home page navigation',
  ],
  unsupported: [
    'Template scripts are paused while editing (sliders and animations are laid out statically)',
    'Server features of the template (PHP contact forms, newsletter signup) don’t submit',
    'No typed sections: home page sections are limited to showing template pages',
  ],
  recommendations: ['Add a theme.json manifest (Level A) for typed, validated settings and sections'],
  detect(files) {
    const paths = [...files.keys()]
    const built = builtHtml(paths)
    const app = framework(files)
    if (app && built) return { confidence: 0.8, entry: dirOf(built), detected: `${app} build output` }
    const html = paths.filter((p) => /^html?$/.test(ext(p)) && !DOC_DIR.test(p))
    if (!html.length) return null
    const index = shallowest(html.filter((p) => /^index\.html?$/i.test(base(p))))
    return { confidence: index ? 0.85 : 0.6, entry: dirOf(index ?? shallowest(html)), detected: 'Static HTML/CSS/JS' }
  },
}

/** In priority order; the first adapter that detects the package wins. */
export const ADAPTERS: ThemeAdapter[] = [nativeAdapter, liquidAdapter, wordpressAdapter, sourceAppAdapter, htmlAdapter]

export const adapterFor = (kind: 'native' | 'html') => (kind === 'native' ? nativeAdapter : htmlAdapter)

export function detectAdapter(files: Files): { adapter: ThemeAdapter; detection: Detection } | null {
  for (const adapter of ADAPTERS) {
    const detection = adapter.detect(files)
    if (detection) return { adapter, detection }
  }
  return null
}

/** Compatibility report saved with the theme and shown in the library. */
export function buildReport(adapter: ThemeAdapter, detection: Pick<Detection, 'confidence' | 'detected'>, counts: ThemeReport['counts'], warnings: string[]): ThemeReport {
  return {
    adapter: adapter.id,
    adapterVersion: adapter.version,
    label: adapter.label,
    level: adapter.level,
    detected: detection.detected,
    confidence: detection.confidence,
    counts,
    capabilities: adapter.capabilities,
    unsupported: adapter.unsupported,
    warnings,
    recommendations: adapter.recommendations,
  }
}
