'use client'

import { useState } from 'react'
import { moderatePhotosAction } from './actions'

type Item = { id: string; status: 'pending' | 'approved' | 'hidden' | 'rejected'; name: string | null; showName: boolean; date: string; source: string; invitation: string | null }

const STATUS = { pending: 'Pendente', approved: 'Aprovada', hidden: 'Oculta', rejected: 'Rejeitada' } as const
const TONE = { pending: 'warn', approved: 'ok', hidden: '', rejected: 'bad' } as const

export function PhotoGrid({ items, canEdit }: { items: Item[]; canEdit: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const ids = [...selected].join(',')
  const bulk = (to: string, label: string) => (
    <form action={moderatePhotosAction} onSubmit={() => setSelected(new Set())}>
      <input type="hidden" name="ids" value={ids} />
      <button className="a-btn a-btn--sm" name="to" value={to}>
        {label}
      </button>
    </form>
  )

  return (
    <>
      <div className="a-actions" style={{ marginBottom: 10 }}>
        <button type="button" className="a-btn a-btn--sm" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>
          Selecionar todas
        </button>
        {selected.size ? (
          <button type="button" className="a-btn a-btn--sm a-btn--ghost" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </button>
        ) : null}
      </div>
      <div className="a-photos">
        {items.map((p) => (
          <figure key={p.id} className="a-photo" style={{ margin: 0, outline: selected.has(p.id) ? '3px solid var(--sepia)' : undefined }}>
            <input type="checkbox" className="a-photo__select" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label="Selecionar foto" />
            <span className="a-photo__status">
              <span className={`a-badge${TONE[p.status] ? ` a-badge--${TONE[p.status]}` : ''}`}>{STATUS[p.status]}</span>
            </span>
            <a href={`/p/${p.id}/web`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/p/${p.id}/thumb`} alt="" loading="lazy" decoding="async" />
            </a>
            <figcaption className="a-photo__meta">
              <div>
                {p.name ?? <span className="a-muted">Anônima</span>}
                {p.name && p.showName ? <span className="a-muted"> · nome público</span> : null}
              </div>
              <div className="a-muted">
                {p.date} · {p.source === 'camera' ? 'câmera' : 'galeria'}
                {p.invitation ? ` · ${p.invitation}` : ''}
              </div>
              <div className="a-row-actions" style={{ marginTop: 6 }}>
                {canEdit && p.status !== 'approved' ? (
                  <form action={moderatePhotosAction}>
                    <input type="hidden" name="ids" value={p.id} />
                    <button className="a-btn a-btn--sm" name="to" value="approved">
                      Aprovar
                    </button>
                  </form>
                ) : null}
                {canEdit && p.status === 'approved' ? (
                  <form action={moderatePhotosAction}>
                    <input type="hidden" name="ids" value={p.id} />
                    <button className="a-btn a-btn--sm" name="to" value="hidden">
                      Ocultar
                    </button>
                  </form>
                ) : null}
                <a className="a-btn a-btn--sm" href={`/p/${p.id}/original?download=1`}>
                  Original
                </a>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {selected.size ? (
        <div className="a-bulkbar">
          <strong>{selected.size} selecionada(s)</strong>
          {canEdit ? (
            <>
              {bulk('approved', 'Aprovar')}
              {bulk('hidden', 'Ocultar')}
              {bulk('rejected', 'Rejeitar')}
              {bulk('pending', 'Voltar para pendente')}
            </>
          ) : null}
          <a className="a-btn a-btn--sm" href={`/api/admin/fotos/zip?ids=${ids}`}>
            Baixar ZIP
          </a>
        </div>
      ) : null}
    </>
  )
}
