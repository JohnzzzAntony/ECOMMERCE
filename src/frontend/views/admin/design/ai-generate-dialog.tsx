'use client'
// "Generate with AI": screenshots (upload, drop or paste), a screen recording (sampled into frames), pasted code
// and instructions become a custom-code section. With `current`, the same dialog refines an existing section.
import { useEffect, useState } from 'react'
import { Film, Loader2, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/frontend/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { Label } from '@/frontend/components/ui/label'
import { Textarea } from '@/frontend/components/ui/textarea'
import { adminApi, errorMessage } from '../admin-api'

export type GeneratedCode = { label: string; html: string; css: string; js: string }

const MAX_IMAGES = 8
const VIDEO_FRAMES = 6
const MAX_WIDTH = 1600

/** Draws a source onto a canvas no wider than MAX_WIDTH and returns a JPEG data URL. */
function toJpeg(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_WIDTH / width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

async function imageFrame(file: File) {
  const bitmap = await createImageBitmap(file)
  try { return toJpeg(bitmap, bitmap.width, bitmap.height) } finally { bitmap.close() }
}

/** Frames evenly spread over the video (first ~60 s), in time order. */
async function videoFrames(file: File) {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true; video.preload = 'auto'; video.src = url
  try {
    await new Promise<void>((ok, fail) => { video.onloadeddata = () => ok(); video.onerror = () => fail(new Error('This video format can’t be read by the browser.')) })
    const span = Math.min(video.duration || 0, 60)
    const frames: string[] = []
    for (let i = 0; i < VIDEO_FRAMES; i++) {
      video.currentTime = span * (i + 0.5) / VIDEO_FRAMES
      await new Promise<void>((ok) => { video.onseeked = () => ok() })
      frames.push(toJpeg(video, video.videoWidth, video.videoHeight))
    }
    return frames
  } finally { URL.revokeObjectURL(url) }
}

export function AiGenerateDialog({ open, onClose, onResult, current }: { open: boolean; onClose: () => void; onResult: (code: GeneratedCode) => void; current?: GeneratedCode }) {
  const [images, setImages] = useState<string[]>([])
  const [fromVideo, setFromVideo] = useState(false)
  const [code, setCode] = useState('')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!busy) return
    const started = Date.now()
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    return () => { clearInterval(t); setElapsed(0) }
  }, [busy])

  const addFiles = async (files: File[]) => {
    try {
      const video = files.find((f) => f.type.startsWith('video/'))
      if (video) { setImages(await videoFrames(video)); setFromVideo(true); return }
      const picked = files.filter((f) => f.type.startsWith('image/'))
      if (!picked.length) return
      const frames = await Promise.all(picked.map(imageFrame))
      setImages((prev) => [...(fromVideo ? [] : prev), ...frames].slice(0, MAX_IMAGES)); setFromVideo(false)
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const generate = async () => {
    setBusy(true)
    try {
      const result = await adminApi.post<GeneratedCode>('/api/design/ai/generate', { images, fromVideo, code, instructions, current })
      onResult(result)
      setImages([]); setCode(''); setInstructions(''); setFromVideo(false)
      onClose()
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  const empty = !images.length && !code.trim() && !instructions.trim()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-2xl" onPaste={(e) => { const files = [...e.clipboardData.files]; if (files.length) { e.preventDefault(); void addFiles(files) } }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-brand-teal" /> {current ? 'Change this section with AI' : 'Generate a section with AI'}</DialogTitle>
          <DialogDescription>{current
            ? 'Describe what to change, and add a screenshot, a recording or code if they help.'
            : 'Add screenshots of a page, section or element, a screen recording of an animation, or code, and AI builds it as a section you can edit and publish.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-files">Screenshots or a video</Label>
            <label htmlFor="ai-files" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles([...e.dataTransfer.files]) }}
              className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground hover:border-brand-teal">
              <span>Drop files here, click to choose, or paste a screenshot (Ctrl+V)</span>
              <span className="text-xs">Up to {MAX_IMAGES} images, or one video ({VIDEO_FRAMES} frames are sampled)</span>
            </label>
            <input id="ai-files" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/*" multiple className="sr-only" onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {fromVideo && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Film className="size-3.5" /> Video frames</span>}
                {images.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt={`Reference ${i + 1}`} className="h-16 w-24 rounded border object-cover" />
                    <button type="button" aria-label={`Remove reference ${i + 1}`} onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5"><X className="size-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-code">Code (optional)</Label>
            <Textarea id="ai-code" rows={4} className="font-mono text-xs" placeholder="Paste HTML/CSS/JS, a React component or a CodePen…" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-instructions">Instructions (optional)</Label>
            <Textarea id="ai-instructions" rows={3} maxLength={4000} placeholder={current ? 'e.g. Make the heading larger and fade the cards in on scroll' : 'e.g. Use our teal brand colour #0f766e and fade the cards in on scroll'} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-2">
            {busy && <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">Generating… {elapsed}s (this can take a minute or two)</span>}
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={generate} disabled={busy || empty} className="bg-brand-teal hover:bg-brand-teal-dark">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {current ? 'Apply changes' : 'Generate section'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
