// AI section generator: turns screenshots, video frames, pasted code and instructions into a custom-code section
// (HTML/CSS/JS). Talks to any OpenAI-compatible chat completions API (NVIDIA NIM by default) configured in .env.
import { HttpError } from '@/backend/lib/auth'

export type GeneratedCode = { label: string; html: string; css: string; js: string }
export type GenerateInput = {
  /** data: URLs of screenshots, or of frames sampled from a video (in time order). */
  images: string[]
  fromVideo: boolean
  code: string
  instructions: string
  /** The section's current code, when refining an existing section. */
  current?: GeneratedCode
}

const SYSTEM = `You are a senior front-end developer who rebuilds web designs pixel-perfectly as one self-contained website section.

Output exactly this format and nothing else:
LABEL: <short name for the section, max 6 words>
\`\`\`html
<the section markup: body content only, no <html>, <head>, <body> or <style> tags>
\`\`\`
\`\`\`css
<all styles>
\`\`\`
\`\`\`js
<vanilla JavaScript for animations and interactions, or leave empty>
\`\`\`

Rules:
- Match the reference exactly: layout, spacing, colours, font sizes and weights, border radius, shadows, alignment and copy text.
- Responsive: looks right from 360px to 1920px wide (use flex/grid, clamp(), media queries).
- Use Google Fonts via @import at the top of the CSS when the design needs a specific typeface.
- Images: use https://placehold.co/<width>x<height>/<hex>/<hex> placeholders sized like the original, with both hex values set to the photo's dominant colour (no text shows), and meaningful alt text; draw icons as inline SVG.
- Motion: reproduce animations and transitions seen in video frames or code with CSS animations/transitions, IntersectionObserver or requestAnimationFrame. Respect prefers-reduced-motion.
- Scope every CSS selector under one root class on the outer element so styles cannot leak. Do not style html or body except margin:0.
- Accessible: semantic elements, one h2 as the main heading, visible focus styles, sufficient contrast.
- No external scripts unless absolutely needed (then only from https://cdn.jsdelivr.net or https://unpkg.com). No alert(), no forms posting anywhere.`

function userContent(input: GenerateInput) {
  const parts: { type: 'text'; text: string }[] = []
  const text = (t: string) => parts.push({ type: 'text', text: t })
  if (input.current) text(`Update this existing section. Return the complete updated section.\n\`\`\`html\n${input.current.html}\n\`\`\`\n\`\`\`css\n${input.current.css}\n\`\`\`\n\`\`\`js\n${input.current.js}\n\`\`\``)
  if (input.images.length) text(input.fromVideo
    ? `The ${input.images.length} images are frames sampled in order from a screen recording. Rebuild the section and reproduce the motion between the frames.`
    : `Rebuild the design shown in ${input.images.length === 1 ? 'this screenshot' : `these ${input.images.length} screenshots`}.`)
  if (input.code.trim()) text(`Reference code to adapt (convert it to plain HTML/CSS/JS if it uses a framework):\n\`\`\`\n${input.code}\n\`\`\``)
  if (input.instructions.trim()) text(`Instructions: ${input.instructions}`)
  return [...parts, ...input.images.map((url) => ({ type: 'image_url' as const, image_url: { url } }))]
}

/** The LABEL line and the html/css/js fences of a model reply. */
export function parseGenerated(reply: string): GeneratedCode {
  const body = reply.replace(/<think>[\s\S]*?<\/think>/g, '')
  const fence = (langs: string) => body.match(new RegExp('```(?:' + langs + ')[^\\n]*\\n([\\s\\S]*?)```', 'i'))?.[1]?.trim() ?? ''
  const html = fence('html|xml')
  if (!html) throw new HttpError(502, 'The AI did not return any HTML. Try again, or add more detail to the instructions.')
  const label = body.match(/^\s*LABEL:\s*(.+)$/m)?.[1]?.trim().slice(0, 120) || 'AI section'
  // Models sometimes put a whole document in the html block; keep only the body content.
  const inner = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
  return { label, html: inner.trim(), css: fence('css'), js: fence('js|javascript') }
}

export function aiConfigured() {
  return !!process.env.AI_DESIGN_API_KEY
}

export async function generateSection(input: GenerateInput): Promise<GeneratedCode> {
  const key = process.env.AI_DESIGN_API_KEY
  if (!key) throw new HttpError(503, 'AI generation is not set up. Add AI_DESIGN_API_KEY to the server environment.')
  const base = (process.env.AI_DESIGN_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '')
  const model = process.env.AI_DESIGN_MODEL || 'nvidia/nemotron-3.5-super-vl-120b-a12b'
  let res: Response
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.3, top_p: 1, max_tokens: 16_384, stream: false, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userContent(input) }] }),
      signal: AbortSignal.timeout(300_000),
    })
  } catch (e) {
    throw new HttpError(504, (e as Error)?.name === 'TimeoutError' ? 'The AI took too long to answer. Try again, or with fewer images.' : 'Could not reach the AI service.')
  }
  const data = await res.json().catch(() => null) as { choices?: { message?: { content?: string } }[]; detail?: string; error?: { message?: string } } | null
  if (!res.ok) {
    console.error('AI design generation failed', res.status, data?.detail ?? data?.error?.message)
    throw new HttpError(502, res.status === 429 ? 'The AI service is busy (rate limit). Wait a minute and try again.' : `The AI service returned an error (${res.status}).`)
  }
  return parseGenerated(data?.choices?.[0]?.message?.content ?? '')
}
