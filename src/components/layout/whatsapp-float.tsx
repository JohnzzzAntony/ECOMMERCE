'use client'

import { MessageCircle } from 'lucide-react'
import { useStore } from '@/store/use-store'

export function WhatsAppFloat() {
  const { settings } = useStore()
  const number = settings.whatsapp || '971501234567'
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg animate-float-pulse transition-transform hover:scale-110"
    >
      <MessageCircle size={28} fill="white" className="-scale-x-100" />
    </a>
  )
}
