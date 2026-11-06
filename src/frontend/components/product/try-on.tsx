'use client'
// AI try-on on product pages: take a photo with the camera (or upload one), pick the garment type,
// and get an image of the shopper wearing the product from /api/try-on. Photos stay in memory only.
import { useEffect, useRef, useState } from 'react'
import { Camera, Download, Loader2, RotateCcw, Sparkles, Timer, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog'
import { guessTryOnKind, TRY_ON_CATEGORIES, TRY_ON_LABELS, type TryOnCategory } from '@/shared/try-on'
import type { Product } from '@/shared/types'

const MAX_EDGE = 1024
const primary = { background: 'var(--color-primary, #0D6B8C)', color: 'var(--color-on-primary, #fff)' }
const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-2,8px)] px-4 text-sm font-semibold hover:opacity-90 disabled:opacity-50'
const outline = `${btn} border border-current/30`

// Hidden on product pages for now (free GPU quota too small for real traffic); flip to true to show it again.
const TRY_ON_VISIBLE = false

type Step = 'start' | 'camera' | 'ready' | 'working' | 'done'

export function TryOnButton({ product, className = '' }: { product: Product; className?: string }) {
  const [open, setOpen] = useState(false)
  if (!TRY_ON_VISIBLE || !product.images?.length) return null
  return (
    <>
      <button type="button" className={`${outline} ${className}`} onClick={() => setOpen(true)}>
        <Sparkles className="size-4" aria-hidden /> Try it on
      </button>
      {open && <TryOnDialog product={product} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Draws an image or video frame into a JPEG data URL no larger than MAX_EDGE on its long side. */
function toJpeg(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

function cameraMessage(error: unknown) {
  const name = (error as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was blocked. Allow it in your browser’s site settings, or upload a photo instead.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device. Upload a photo instead.'
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again, or upload a photo.'
  return 'The camera could not be started. Upload a photo instead.'
}

function TryOnDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const kind = guessTryOnKind(product.name, product.category?.name, product.category?.parent?.name)
  const [category, setCategory] = useState<TryOnCategory | ''>(kind && kind !== 'accessory' ? kind : '')
  const [step, setStep] = useState<Step>('start')
  const [photo, setPhoto] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef<AbortController | null>(null)

  const stopCamera = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null }
  // Release the camera and cancel a pending request when the dialog closes.
  useEffect(() => () => { stopCamera(); requestRef.current?.abort() }, [])
  useEffect(() => {
    if (step === 'camera' && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current
  }, [step])
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) { setCountdown(null); capture(); return }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(t)
  })

  async function startCamera() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) { setError('This browser can’t use the camera here (it needs a secure https page). Upload a photo instead.'); return }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      setStep('camera')
    } catch (e) { setError(cameraMessage(e)) }
  }

  function capture() {
    const video = videoRef.current
    if (!video?.videoWidth) return
    setPhoto(toJpeg(video, video.videoWidth, video.videoHeight))
    stopCamera()
    setStep('ready')
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) { setError('Choose an image file (JPEG or PNG).'); return }
    if (file.size > 20_000_000) { setError('That photo is too large (20 MB max).'); return }
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      setPhoto(toJpeg(bitmap, bitmap.width, bitmap.height))
      bitmap.close()
      stopCamera()
      setStep('ready')
    } catch { setError('That photo could not be read. Try a JPEG or PNG.') }
  }

  async function generate() {
    if (!photo || !category) return
    setError(null)
    setStep('working')
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const res = await fetch('/api/try-on', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id, category, photo }), signal: controller.signal })
      const data = await res.json().catch(() => ({})) as { image?: string; error?: string }
      if (!res.ok || !data.image) throw new Error(data.error || 'The try-on could not be created. Please try again.')
      setResult(data.image)
      setStep('done')
    } catch (e) {
      if (controller.signal.aborted) return
      setError(e instanceof Error ? e.message : 'The try-on could not be created.')
      setStep('ready')
    }
  }

  function retake() { setPhoto(null); setResult(null); setError(null); setStep('start') }

  const upload = (
    <>
      <button type="button" className={outline} onClick={() => fileRef.current?.click()}><Upload className="size-4" aria-hidden /> Upload a photo</button>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
    </>
  )

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Try on {product.name}</DialogTitle>
          <DialogDescription>
            AI preview of you wearing this item. Your photo is sent to our AI try-on provider (Hugging Face) only to create the image, and this store does not save it.
          </DialogDescription>
        </DialogHeader>

        {step !== 'done' && (
          <label className="grid gap-1 text-sm font-medium">
            What kind of item is this?
            <select className="min-h-11 rounded-[var(--radius-2,8px)] border border-current/30 bg-transparent px-3" value={category} disabled={step === 'working'}
              onChange={(e) => setCategory(e.target.value as TryOnCategory | '')}>
              <option value="">Choose…</option>
              {TRY_ON_CATEGORIES.map((c) => <option key={c} value={c}>{TRY_ON_LABELS[c]}</option>)}
            </select>
            {kind === 'accessory' && <span className="font-normal opacity-75">Try-on works for clothing. Sunglasses, caps, jewellery, bags and shoes aren’t supported yet.</span>}
          </label>
        )}

        {step === 'start' && (
          <div className="grid gap-3">
            <p className="text-sm opacity-80">For the best result, stand facing the camera with your whole upper body (or full body for dresses and trousers) in good light, in fitted clothes.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" style={primary} className={btn} onClick={startCamera}><Camera className="size-4" aria-hidden /> Use camera</button>
              {upload}
            </div>
          </div>
        )}

        {step === 'camera' && (
          <div className="grid gap-3">
            <div className="relative overflow-hidden rounded-[var(--radius-3,12px)] bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-[3/4] w-full -scale-x-100 object-cover" aria-label="Camera preview" />
              {countdown !== null && <span className="absolute inset-0 flex items-center justify-center text-7xl font-bold text-white drop-shadow" aria-live="assertive">{countdown}</span>}
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" style={primary} className={btn} onClick={capture} disabled={countdown !== null}><Camera className="size-4" aria-hidden /> Take photo</button>
              <button type="button" className={outline} onClick={() => setCountdown(5)} disabled={countdown !== null}><Timer className="size-4" aria-hidden /> 5s timer</button>
              {upload}
            </div>
          </div>
        )}

        {(step === 'ready' || step === 'working') && photo && (
          <div className="grid gap-3">
            <div className="relative">
              <img src={photo} alt="Your photo" className="max-h-[55vh] w-full rounded-[var(--radius-3,12px)] object-contain" />
              {step === 'working' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-3,12px)] bg-black/60 p-4 text-center text-white" role="status">
                  <Loader2 className="size-8 animate-spin" aria-hidden />
                  <span>Creating your try-on… this usually takes 20–60 seconds.</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" style={primary} className={btn} onClick={generate} disabled={!category || step === 'working'}><Sparkles className="size-4" aria-hidden /> Generate try-on</button>
              <button type="button" className={outline} onClick={retake} disabled={step === 'working'}><RotateCcw className="size-4" aria-hidden /> Use another photo</button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="grid gap-3">
            <img src={result} alt={`You wearing ${product.name} (AI-generated preview)`} className="max-h-[60vh] w-full rounded-[var(--radius-3,12px)] object-contain" />
            <p className="text-xs opacity-70">AI-generated preview. Fit, length and fine details such as prints or logos may differ from the real item.</p>
            <div className="flex flex-wrap gap-3">
              <a href={result} download={`try-on-${product.slug}.jpg`} style={primary} className={btn}><Download className="size-4" aria-hidden /> Save image</a>
              <button type="button" className={outline} onClick={retake}><RotateCcw className="size-4" aria-hidden /> Try another photo</button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
