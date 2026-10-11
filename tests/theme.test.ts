// Theme packages (native + HTML template import), settings → CSS, and menu links.
import { expect, test } from 'bun:test'
import { strToU8, zipSync } from 'fflate'
import { extractMenus, extractOptions, pageTitles, readThemePackage } from '../src/backend/lib/theme-package'
import { cleanMenu, cleanSections, cleanSettings } from '../src/backend/lib/theme-store'
import { CORE_SETTINGS, mergeSchema, resolveLink, sectionSchema, themeVariablesCss } from '../src/shared/theme'

const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))

function fakeUpload() {
  const uploaded: string[] = []
  return { uploaded, upload: async (path: string) => { uploaded.push(path); return `https://cdn.test/${path}` } }
}

test('HTML template: pages, CSS, scripts, assets and links are imported; docs and tracking are dropped', async () => {
  const { uploaded, upload } = fakeUpload()
  const plan = await readThemePackage(zip({
    'pkg/template/index.html': `<!doctype html><html><head><title>Medi | Home</title>
      <link rel="stylesheet" href="css/style.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto">
      <style>.x{background:url(img/a.png)}</style><script src="js/app.js"></script><script>gtag('config','x')</script></head>
      <body class="home page"><a href="about.html#team">About</a><img src="img/a.png" srcset="img/a.png 1x, img/b.png 2x">
      <script>alert(1)</script><a href="https://example.com">ext</a></body></html>`,
    'pkg/template/about.html': '<html><head><title>About Us</title></head><body><a href="index.html">Home</a></body></html>',
    'pkg/template/css/style.css': '@import "base.css";\nbody{background:url("../img/bg.jpg")}',
    'pkg/template/css/base.css': '@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap");\n:root{--size:1.6rem}\n@font-face{src:url(../fonts/f.woff2)}',
    'pkg/template/img/a.png': 'png', 'pkg/template/img/b.png': 'png', 'pkg/template/img/bg.jpg': 'jpg',
    'pkg/template/img/unused.png': 'png', 'pkg/template/fonts/f.woff2': 'font', 'pkg/template/js/app.js': 'x()',
    'pkg/documentation/index.html': '<html><body>docs</body></html>',
  }), { upload, slugTaken: async () => false, fileName: 'medi-template.zip' })

  expect(plan.kind).toBe('html')
  expect(plan.name).toBe('medi template')
  expect(plan.pages.map((p) => p.slug)).toEqual(['home', 'about'])
  const [home, about] = plan.pages
  expect(home.title).toBe('Medi – Home')
  expect(home.bodyClass).toBe('home page')
  expect(home.layout).toBe('isolated')
  expect(home.content.indexOf('<script src="https://cdn.test/pkg/template/js/app.js"></script>')).toBe(0) // head scripts first
  expect(home.content).toContain('<script>alert(1)</script>')
  expect(home.content).not.toContain('gtag')
  expect(home.content).toContain('href="/?page=about#team"')
  expect(home.content).toContain('src="https://cdn.test/pkg/template/img/a.png"')
  expect(home.content).toContain('https://cdn.test/pkg/template/img/b.png 2x')
  expect(home.content).toContain('href="https://example.com"')
  expect(home.css).toContain('url("https://cdn.test/pkg/template/img/a.png")')
  expect(about.content).toContain('href="/?page=home"')
  expect(plan.css.indexOf('@import url("https://fonts.googleapis.com')).toBe(0)
  expect(plan.css).toContain('@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap");')
  expect(plan.css).toContain(':root{--size:1.6rem}')
  expect(plan.css.match(/1,100\.\.800&display=swap/g)).toHaveLength(1) // only inside the hoisted @import
  expect(plan.css).toContain('url("https://cdn.test/pkg/template/img/bg.jpg")')
  expect(plan.css).toContain('url("https://cdn.test/pkg/template/fonts/f.woff2")')
  expect(uploaded.sort()).toEqual(['a.png', 'b.png', 'bg.jpg'].map((f) => `pkg/template/img/${f}`).concat('pkg/template/fonts/f.woff2', 'pkg/template/js/app.js').sort())
  expect(plan.sections).toEqual([{ id: 's-page-home', type: 'page', enabled: true, settings: { page: 'home' } }])
  expect(plan.settings.hide_chrome_on_home).toBe(true)
})

test('WordPress and Shopify themes are rejected with a clear reason', async () => {
  const opts = { ...fakeUpload(), slugTaken: async () => false }
  await expect(readThemePackage(zip({ 'wp/style.css': '/*\nTheme Name: Foo\n*/', 'wp/index.php': '<?php' }), opts)).rejects.toThrow('WordPress')
  await expect(readThemePackage(zip({ 's/layout/theme.liquid': '{{ content_for_layout }}' }), opts)).rejects.toThrow('Shopify')
  await expect(readThemePackage(strToU8('not a zip'), opts)).rejects.toThrow('.zip')
  await expect(readThemePackage(zip({ 'a/readme.txt': 'hi' }), opts)).rejects.toThrow('No theme found')
})

test('native package: schema, settings, sections, menus and pages; taken page slugs are remapped', async () => {
  const { upload } = fakeUpload()
  const plan = await readThemePackage(zip({
    'aurora/theme.json': JSON.stringify({
      name: 'Aurora', version: '2.0.0',
      settings_schema: [
        { id: 'promo_image', type: 'image', label: 'Promo', default: 'assets/hero.jpg' },
        { id: 'bad id', type: 'color', label: 'x' },
      ],
      settings: { color_primary: '#6D28D9', color_accent: 'red;}body{x', unknown_key: 'x' },
      sections: [{ type: 'hero' }, { type: 'page', settings: { page: 'about' } }, { type: 'nope' }],
      menus: { main: [{ label: 'About', link: 'page:about' }, { label: 'Shop', link: 'mega:categories' }] },
      pages: [{ slug: 'about', title: 'About', file: 'pages/about.html' }],
    }),
    'aurora/assets/theme.css': '.hero{background:url(hero.jpg)}',
    'aurora/assets/hero.jpg': 'jpg',
    'aurora/pages/about.html': '<html><body><h1>About</h1><img src="../assets/hero.jpg"></body></html>',
  }), { upload, slugTaken: async (s) => s === 'about' })

  expect(plan.kind).toBe('native')
  expect(plan.version).toBe('2.0.0')
  expect(plan.schema.map((d) => d.id)).toEqual(['promo_image'])
  expect(plan.schema[0].default).toBe('https://cdn.test/aurora/assets/hero.jpg')
  expect(plan.settings).toEqual({ color_primary: '#6D28D9' })
  expect(plan.sections.map((s) => s.type)).toEqual(['hero', 'page'])
  expect(plan.sections[1].settings.page).toBe('about-2')
  expect(plan.menus.main?.[0].link).toBe('page:about-2')
  expect(plan.pages[0]).toMatchObject({ slug: 'about-2', title: 'About', layout: 'standard' })
  expect(plan.pages[0].content).toContain('src="https://cdn.test/aurora/assets/hero.jpg"')
  expect(plan.css).toContain('url("https://cdn.test/aurora/assets/hero.jpg")')
})

test('settings become CSS variables; values cannot break out of the declaration', () => {
  const schema = mergeSchema([{ id: 'gap', type: 'range', label: 'Gap', var: '--gap', unit: 'px' }])
  const css = themeVariablesCss(schema, { color_primary: '#111111', radius: 6, gap: 12, logo_text: 'x', color_accent: 'red;}</style><script>' })
  expect(css).toContain('--brand-teal:#111111')
  expect(css).toContain('--primary:#111111')
  expect(css).toContain('--radius:6px')
  expect(css).toContain('--gap:12px')
  expect(css).not.toMatch(/[<>]/)
  expect(css.match(/[{}]/g)).toEqual(['{', '}'])
})

test('admin settings are validated against the schema', () => {
  const schema = mergeSchema([])
  expect(cleanSettings({ color_primary: '#abc', color_text: 'url(x)', radius: 99, show_announcement: 'yes', nope: 1 }, schema))
    .toEqual({ color_primary: '#abc', radius: 24 })
  expect(CORE_SETTINGS.find((d) => d.id === 'radius')?.max).toBe(24)
})

test('menu links resolve to views, pages, catalog and URLs; unsafe links are refused', () => {
  expect(resolveLink('view:offers')).toEqual({ kind: 'view', view: 'offers' })
  expect(resolveLink('view:admin')).toEqual({ kind: 'none' })
  expect(resolveLink('page:about')).toEqual({ kind: 'view', view: 'page', params: { slug: 'about' } })
  expect(resolveLink('category:wheelchairs')).toEqual({ kind: 'view', view: 'products-category', params: { categorySlug: 'wheelchairs' } })
  expect(resolveLink('mega:brands')).toEqual({ kind: 'mega', source: 'brands' })
  expect(resolveLink('https://x.com')).toEqual({ kind: 'href', href: 'https://x.com', external: true })
  expect(resolveLink('javascript:alert(1)')).toEqual({ kind: 'none' })
  expect(() => cleanMenu([{ label: 'x', link: 'javascript:alert(1)' }])).toThrow('Unsupported link')
  expect(() => cleanMenu([{ label: ' ', link: '' }])).toThrow('label')
  const nested = cleanMenu([{ label: 'A', link: '', children: [{ label: 'B', link: 'view:faq', children: [{ label: 'C', link: '' }] }] }])
  expect(nested[0].children?.[0].children).toBeUndefined()
})

test('template page titles drop the shared brand and fall back to file names', () => {
  expect(pageTitles([{ title: 'Medi | Home', slug: 'home' }, { title: 'Medi | About Us', slug: 'about' }])).toEqual(['Home', 'About Us'])
  expect(pageTitles([{ title: 'Azurio', slug: 'home' }, { title: 'Azurio', slug: 'about-us' }])).toEqual(['Home', 'About Us'])
  expect(pageTitles([{ title: 'Contact', slug: 'contact' }])).toEqual(['Contact'])
})

test('section settings are validated against the section schema', () => {
  const [hero, html] = cleanSections([
    { id: 'h', type: 'hero', settings: { title: 'Hi', height: 5000, animation: 'zoom', bg_color: 'red;}', link: 'javascript:alert(1)', heading_font: 'Comic', nope: 1 } },
    { id: 'r', type: 'rich_text', settings: { html: '<b>x</b>'.repeat(2000), animation: 'spin' } },
    { id: 'x', type: 'unknown' },
  ])
  expect(hero.settings).toEqual({ title: 'Hi', height: 900, animation: 'zoom' })
  expect(String(html.settings.html).length).toBe(16000)
  expect(html.settings.animation).toBeUndefined()
  expect(sectionSchema('banner').map((d) => d.id)).toContain('padding_top')
})

test('editorial sections keep their content settings and drop invalid ones', () => {
  const [banner, slider, grid] = cleanSections([
    { type: 'image_banner', settings: { image: 'https://cdn.test/a.jpg', title: 'Hi', content_vertical: 'middle', overlay: 500, link: 'javascript:alert(1)' } },
    { type: 'product_slider', settings: { source: 'on_sale', per_view: 9 } },
    { type: 'link_grid', settings: { tile_1_label: 'Chairs', tile_1_link: 'category:chairs', tile_9_label: 'nope' } },
  ])
  expect(banner.settings).toEqual({ image: 'https://cdn.test/a.jpg', title: 'Hi', overlay: 90 })
  expect(slider.settings).toEqual({ source: 'on_sale', per_view: 6 })
  expect(grid.settings).toEqual({ tile_1_label: 'Chairs', tile_1_link: 'category:chairs' })
})

test('heading weight setting is emitted as a CSS variable', () => {
  expect(themeVariablesCss(CORE_SETTINGS, { heading_weight: 500 })).toBe(':root{--theme-heading-weight:500}')
})

test('HTML template options: :root variables become settings, otherwise brand colors are made variables', () => {
  const withVars = extractOptions(':root{--primary-color:#e11d48;--font-heading:"Poppins",sans-serif;--gap:12px}')
  expect(withVars.schema.map((d) => [d.id, d.type, d.var, d.default])).toEqual([
    ['tpl_primary_color', 'color', '--primary-color', '#e11d48'],
    ['tpl_font_heading', 'text', '--font-heading', '"Poppins",sans-serif'],
  ])
  const plain = extractOptions('a{color:#E11D48}.b{background:#e11d48}.c{border:1px solid #e11d48}#fff{color:#fff}.d{color:#123}')
  expect(plain.schema).toEqual([{ id: 'tpl_color_1', type: 'color', label: 'Color 1 (most used)', group: 'Template colors', default: '#e11d48', var: '--tpl-color-1' }])
  expect(plain.css).toContain('a{color:var(--tpl-color-1, #E11D48)}')
  expect(plain.css).toContain('#fff{color:#fff}') // selectors and greys untouched
})

test('HTML template menus come from <nav> and <footer> links to imported pages', () => {
  const slugs = new Map([['t/about.html', 'about'], ['t/index.html', 'home']])
  const menus = extractMenus(
    '<header><nav><a href="index.html">Home</a><a href="about.html"><span>About</span> us</a><a href="#">Skip</a><a href="https://x.com">X</a></nav></header><footer><a href="about.html">About</a></footer>',
    't/index.html', 't/', (p) => slugs.get(p),
  )
  expect(menus.main?.map((m) => [m.label, m.link])).toEqual([['Home', 'page:home'], ['About us', 'page:about'], ['X', 'https://x.com']])
  expect(menus.footer?.[0].children?.map((m) => m.link)).toEqual(['page:about'])
})

test('App source projects use their build output, or ask for a build', async () => {
  const opts = { ...fakeUpload(), slugTaken: async () => false }
  const built = await readThemePackage(zip({ 'app/package.json': '{}', 'app/index.html': '<div id="root"></div>', 'app/dist/index.html': '<html><body><div id="root">x</div></body></html>' }), opts)
  expect(built.pages.map((p) => p.slug)).toEqual(['home'])
  await expect(readThemePackage(zip({ 'app/package.json': '{}', 'app/index.html': '<body><div id="root"></div></body>', 'app/src/App.jsx': 'x' }), opts)).rejects.toThrow('npm run build')
})
