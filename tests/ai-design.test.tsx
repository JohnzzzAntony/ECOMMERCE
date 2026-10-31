import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomCode from '../src/frontend/components/sections/custom-code'
import { parseGenerated } from '../src/backend/lib/ai-design'
import { defaultSettings, validateSection } from '../src/shared/sections/registry'

describe('AI section generator', () => {
  test('parses the label and the html/css/js fences, ignoring reasoning', () => {
    const reply = '<think>```html\n<p>draft</p>\n```</think>\nLABEL: Pricing cards\n```html\n<section class="p"><h2>Plans</h2></section>\n```\n```css\n.p{color:red}\n```\n```javascript\nconsole.log(1)\n```'
    expect(parseGenerated(reply)).toEqual({ label: 'Pricing cards', html: '<section class="p"><h2>Plans</h2></section>', css: '.p{color:red}', js: 'console.log(1)' })
  })

  test('keeps only the body of a full document and defaults the label', () => {
    const r = parseGenerated('```html\n<!doctype html><html><head><title>x</title></head><body class="a"><main>Hi</main></body></html>\n```')
    expect(r).toEqual({ label: 'AI section', html: '<main>Hi</main>', css: '', js: '' })
  })

  test('fails clearly when there is no html', () => {
    expect(() => parseGenerated('Sorry, I cannot help.')).toThrow(/did not return any HTML/)
  })

  test('custom-code sections validate with generated code and reject oversized code', () => {
    const base = { id: 'abc123', type: 'custom-code', settings: { ...defaultSettings('custom-code'), html: '<div></div>', js: 'x()' } }
    expect(validateSection(base).ok).toBe(true)
    expect(validateSection({ ...base, settings: { ...base.settings, css: 'a'.repeat(200_001) } }).ok).toBe(false)
  })

  test('renders the code in a sandboxed frame without same-origin access', () => {
    const settings = { label: 'Promo', html: '<h2>Hi</h2>', css: 'h2{color:red}', js: 'document.title="</script><b>x</b>"' }
    const html = renderToStaticMarkup(<CustomCode section={{ id: 's1', type: 'custom-code', figmaNodeId: null, settings, blocks: [], responsive: {}, hidden: false, overriddenFields: [], mappingConfidence: 1 }} data={undefined} page={undefined as never} priority={false} />)
    expect(html).toContain('sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"')
    expect(html).toContain('title="Promo"')
    expect(html).toContain('&lt;h2&gt;Hi&lt;/h2&gt;&lt;script&gt;document.title=&quot;&lt;\/script&gt;') // "</script" in the JS can't close the tag
  })
})
