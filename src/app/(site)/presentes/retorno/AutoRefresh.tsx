'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/** Enquanto o pagamento aguarda confirmação, atualiza a página a cada 5 s (até 3 min). */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter()
  const count = useRef(0)
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => {
      count.current += 1
      if (count.current > 36) return window.clearInterval(id)
      router.refresh()
    }, 5000)
    return () => window.clearInterval(id)
  }, [active, router])
  return null
}
