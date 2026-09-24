'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Envia imagens uma a uma para /api/admin/media (sem limite de corpo das Server Actions). */
export function MediaUploader({ purpose, label = 'Enviar fotos', multiple = true, onUploaded }: { purpose: string; label?: string; multiple?: boolean; onUploaded?: (ids: string[]) => void }) {
  const router = useRouter()
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div>
      <label className="a-btn a-btn--primary" style={{ cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Enviando…' : label}
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          hidden
          disabled={busy}
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (!files.length) return
            setBusy(true)
            const ids: string[] = []
            let failed = 0
            for (const [i, file] of files.entries()) {
              setStatus(`Enviando ${i + 1} de ${files.length}…`)
              const form = new FormData()
              form.append('file', file)
              form.append('purpose', purpose)
              const res = await fetch('/api/admin/media', { method: 'POST', body: form }).catch(() => null)
              if (res?.ok) ids.push(((await res.json()) as { id: string }).id)
              else failed++
            }
            setBusy(false)
            setStatus(failed ? `${ids.length} enviada(s), ${failed} com erro.` : `${ids.length} enviada(s).`)
            onUploaded?.(ids)
            router.refresh()
          }}
        />
      </label>
      {status ? <span className="a-muted" style={{ marginLeft: 10 }}>{status}</span> : null}
    </div>
  )
}
