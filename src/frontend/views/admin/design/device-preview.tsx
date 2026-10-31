'use client'
import { useEffect, useRef, useState, type ComponentProps, type Ref } from 'react'

export const DEVICE_SIZES = { desktop: { width: 1280, height: 832 }, tablet: { width: 820, height: 1180 }, mobile: { width: 390, height: 844 } } as const

/** The preview as a real device viewport (so the right Figma frame shows at its own size), scaled down to fit its box. */
export function DevicePreview({ device, className = '', iframeRef, ...iframe }: { device: keyof typeof DEVICE_SIZES; iframeRef?: Ref<HTMLIFrameElement> } & ComponentProps<'iframe'>) {
  const { width, height } = DEVICE_SIZES[device]
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: width, h: height })
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = Math.min(1, size.w / width, size.h / height)
  return (
    <div ref={box} className={`flex w-full items-start justify-center overflow-hidden ${className}`}>
      <div className="overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/10" style={{ width: width * scale, height: height * scale }}>
        <iframe ref={iframeRef} {...iframe} style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="block border-0" />
      </div>
    </div>
  )
}
