'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'

export function CopyButton({ text, label = 'Copiar', className = 'a-btn a-btn--sm' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          ta.remove()
        }
        setDone(true)
        window.setTimeout(() => setDone(false), 1600)
      }}
    >
      {done ? 'Copiado ✓' : label}
    </button>
  )
}

/** Botão de envio com confirmação (ações destrutivas ou irreversíveis). */
export function ConfirmSubmit({ message, children, className = 'a-btn a-btn--sm a-btn--danger', name, value }: { message: string; children: React.ReactNode; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className={className}
      name={name}
      value={value}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}

export function SubmitButton({ children, className = 'a-btn a-btn--primary', pendingLabel = 'Salvando…' }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  )
}
