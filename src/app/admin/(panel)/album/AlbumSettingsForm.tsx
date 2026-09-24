'use client'

import { useActionState } from 'react'
import type { AlbumFormState } from './actions'

type Album = {
  name: string
  description: string
  closedMessage: string
  status: 'draft' | 'open' | 'closed'
  uploadsEnabled: boolean
  publicGalleryEnabled: boolean
  requireApproval: boolean
  allowAnonymous: boolean
  allowGalleryUpload: boolean
  allowCamera: boolean
  allowMultiple: boolean
  startsAt: string
  endsAt: string
}

export function AlbumSettingsForm({ action, album, readOnly }: { action: (p: AlbumFormState, f: FormData) => Promise<AlbumFormState>; album: Album; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState<AlbumFormState, FormData>(action, {})
  const check = (name: keyof Album, label: string) => (
    <label className="a-check">
      <input type="checkbox" name={name} defaultChecked={album[name] as boolean} /> {label}
    </label>
  )
  return (
    <form action={formAction} className="a-form">
      <fieldset className="a-fieldset" disabled={readOnly}>
        <legend>Álbum</legend>
        <div className="a-form-grid">
          <label className="a-field">
            <span>Nome do álbum</span>
            <input className="a-input" name="name" defaultValue={album.name} />
          </label>
          <label className="a-field">
            <span>Status</span>
            <select className="a-select" name="status" defaultValue={album.status}>
              <option value="draft">Rascunho (fechado, sem aviso)</option>
              <option value="open">Aberto</option>
              <option value="closed">Encerrado (só visualização)</option>
            </select>
          </label>
          <label className="a-field span-2">
            <span>Descrição (aparece ao escanear o QR)</span>
            <input className="a-input" name="description" defaultValue={album.description} />
          </label>
          <label className="a-field">
            <span>Data inicial (opcional)</span>
            <input className="a-input" type="datetime-local" name="startsAt" defaultValue={album.startsAt} />
          </label>
          <label className="a-field">
            <span>Data final (opcional)</span>
            <input className="a-input" type="datetime-local" name="endsAt" defaultValue={album.endsAt} />
          </label>
          <label className="a-field span-2">
            <span>Mensagem de álbum encerrado</span>
            <textarea className="a-textarea" name="closedMessage" rows={2} defaultValue={album.closedMessage} />
          </label>
        </div>
      </fieldset>
      <fieldset className="a-fieldset" disabled={readOnly}>
        <legend>Envios e publicação</legend>
        <div className="a-form-grid">
          <div style={{ display: 'grid', gap: 8 }}>
            {check('uploadsEnabled', 'Uploads liberados')}
            {check('allowCamera', 'Permitir câmera')}
            {check('allowGalleryUpload', 'Permitir envio da galeria do celular')}
            {check('allowMultiple', 'Permitir várias fotos de uma vez')}
            {check('allowAnonymous', 'Permitir fotos anônimas (sem nome)')}
          </div>
          <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
            {check('publicGalleryEnabled', 'Galeria pública ligada')}
            <label className="a-check">
              <input type="radio" name="publish" value="approval" defaultChecked={album.requireApproval} /> Exigir aprovação antes de aparecer publicamente
            </label>
            <label className="a-check">
              <input type="radio" name="publish" value="auto" defaultChecked={!album.requireApproval} /> Publicar automaticamente
            </label>
            <p className="a-help">Toda foto fica salva, mesmo antes de publicada.</p>
          </div>
        </div>
      </fieldset>
      {state.error ? <p className="a-alert a-alert--bad">{state.error}</p> : null}
      {state.ok ? <p className="a-alert a-alert--ok">Configurações salvas.</p> : null}
      {!readOnly ? (
        <div>
          <button className="a-btn a-btn--primary" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>
      ) : null}
    </form>
  )
}
