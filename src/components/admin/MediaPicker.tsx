'use client'

import { useState } from 'react'

/** Campo de imagem única: envia a foto e guarda o id em um input escondido. */
export function MediaPicker({ name, initialId, purpose = 'story', disabled }: { name: string; initialId: string | null; purpose?: string; disabled?: boolean }) {
  const [id, setId] = useState(initialId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name={name} value={id} />
      {id ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/m/${id}/thumb`} alt="" style={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 4 }} />
      ) : (
        <span className="a-muted">Sem foto</span>
      )}
      {!disabled ? (
        <>
          <label className="a-btn a-btn--sm">
            {busy ? 'Enviando…' : id ? 'Trocar foto' : 'Escolher foto'}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setBusy(true)
                setError(null)
                const fd = new FormData()
                fd.append('file', file)
                fd.append('purpose', purpose)
                const res = await fetch('/api/admin/media', { method: 'POST', body: fd }).catch(() => null)
                setBusy(false)
                if (res?.ok) setId(((await res.json()) as { id: string }).id)
                else setError('Não foi possível enviar.')
              }}
            />
          </label>
          {id ? (
            <button type="button" className="a-btn a-btn--sm a-btn--ghost" onClick={() => setId('')}>
              Remover
            </button>
          ) : null}
        </>
      ) : null}
      {error ? <small style={{ color: 'var(--rose)' }}>{error}</small> : null}
    </div>
  )
}
