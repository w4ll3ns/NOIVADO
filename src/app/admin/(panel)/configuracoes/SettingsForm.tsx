'use client'

import { useActionState, useState } from 'react'
import type { SettingsState } from './actions'

export type FieldDef = {
  name: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'time' | 'checkbox' | 'number' | 'url' | 'tel' | 'email' | 'colors' | 'media'
  help?: string
  span?: boolean
  rows?: number
}

type Color = { name: string; hex: string }

function ColorsEditor({ name, initial }: { name: string; initial: Color[] }) {
  const [list, setList] = useState<Color[]>(initial)
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <input type="hidden" name={name} value={JSON.stringify(list.filter((c) => c.name.trim()))} />
      {list.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="color" value={c.hex} onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} aria-label="Cor" />
          <input className="a-input" value={c.name} placeholder="Nome da cor" onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <button type="button" className="a-btn a-btn--sm a-btn--danger" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="a-btn a-btn--sm" style={{ justifySelf: 'start' }} onClick={() => setList((l) => [...l, { name: '', hex: '#b1a190' }])}>
        + Adicionar cor
      </button>
    </div>
  )
}

function MediaListEditor({ name, initial }: { name: string; initial: string[] }) {
  const [ids, setIds] = useState<string[]>(initial)
  const [busy, setBusy] = useState(false)
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(ids)} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {ids.map((id) => (
          <span key={id} style={{ position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/m/${id}/thumb`} alt="" style={{ width: 72, height: 90, objectFit: 'cover', borderRadius: 4 }} />
            <button type="button" className="a-btn a-btn--sm" style={{ position: 'absolute', top: 2, right: 2, minHeight: 24, padding: '0 6px' }} onClick={() => setIds((l) => l.filter((x) => x !== id))}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <label className="a-btn a-btn--sm">
        {busy ? 'Enviando…' : '+ Imagens de referência'}
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            setBusy(true)
            for (const f of files) {
              const fd = new FormData()
              fd.append('file', f)
              fd.append('purpose', 'dress')
              const res = await fetch('/api/admin/media', { method: 'POST', body: fd }).catch(() => null)
              if (res?.ok) {
                const { id } = (await res.json()) as { id: string }
                setIds((l) => [...l, id])
              }
            }
            setBusy(false)
          }}
        />
      </label>
      <p className="a-help">Lembre-se de salvar depois de enviar.</p>
    </div>
  )
}

export function SettingsForm({ action, fields, values, readOnly }: { action: (p: SettingsState, f: FormData) => Promise<SettingsState>; fields: FieldDef[]; values: Record<string, unknown>; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(action, {})
  return (
    <form action={formAction} className="a-form a-card">
      <input type="hidden" name="__fields" value={fields.map((f) => f.name).join(',')} />
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="a-form-grid">
          {fields.map((f) => {
            const v = values[f.name]
            if (f.type === 'checkbox')
              return (
                <label key={f.name} className={`a-check${f.span ? ' span-2' : ''}`}>
                  <input type="checkbox" name={f.name} defaultChecked={!!v} /> {f.label}
                </label>
              )
            return (
              <label key={f.name} className={`a-field${f.span || f.type === 'textarea' || f.type === 'colors' || f.type === 'media' ? ' span-2' : ''}`}>
                <span>{f.label}</span>
                {f.type === 'textarea' ? (
                  <textarea className="a-textarea" name={f.name} rows={f.rows ?? 3} defaultValue={String(v ?? '')} />
                ) : f.type === 'colors' ? (
                  <ColorsEditor name={f.name} initial={(v as Color[]) ?? []} />
                ) : f.type === 'media' ? (
                  <MediaListEditor name={f.name} initial={(v as string[]) ?? []} />
                ) : (
                  <input className="a-input" type={f.type} name={f.name} defaultValue={String(v ?? '')} />
                )}
                {f.help ? <small className="a-help">{f.help}</small> : null}
              </label>
            )
          })}
        </div>
      </fieldset>
      {state.error ? <p className="a-alert a-alert--bad">{state.error}</p> : null}
      {state.ok ? <p className="a-alert a-alert--ok">Salvo! O site já foi atualizado.</p> : null}
      {!readOnly ? (
        <div>
          <button className="a-btn a-btn--primary" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      ) : null}
    </form>
  )
}
