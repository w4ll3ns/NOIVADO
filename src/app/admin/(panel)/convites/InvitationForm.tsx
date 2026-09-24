'use client'

import { useActionState, useState } from 'react'
import type { InvitationFormState } from './actions'

type GuestRow = {
  key: string
  id?: string | null
  firstName: string
  lastName: string
  phone: string
  email: string
  isChild: boolean
  isCompanion: boolean
  attendance: 'pending' | 'yes' | 'no'
}

type Props = {
  action: (prev: InvitationFormState, form: FormData) => Promise<InvitationFormState>
  isNew: boolean
  readOnly?: boolean
  templates: { id: string; name: string }[]
  groups: string[]
  initial: {
    label: string
    greetingName: string
    kind: 'individual' | 'couple' | 'family' | 'group'
    groupName: string
    isCloseFamily: boolean
    phone: string
    email: string
    allowCompanions: boolean
    maxCompanions: number
    whatsappTemplateId: string
    notes: string
    guests: Omit<GuestRow, 'key'>[]
  }
}

let counter = 0
const key = () => `g${++counter}`

export function InvitationForm({ action, isNew, readOnly, templates, groups, initial }: Props) {
  const [state, formAction, pending] = useActionState<InvitationFormState, FormData>(action, {})
  const [guests, setGuests] = useState<GuestRow[]>(() =>
    initial.guests.length
      ? initial.guests.map((g) => ({ ...g, key: key() }))
      : [{ key: key(), firstName: '', lastName: '', phone: '', email: '', isChild: false, isCompanion: false, attendance: 'pending' }],
  )
  const [allowCompanions, setAllowCompanions] = useState(initial.allowCompanions)
  const update = (k: string, patch: Partial<GuestRow>) => setGuests((list) => list.map((g) => (g.key === k ? { ...g, ...patch } : g)))

  return (
    <form action={formAction} className="a-form">
      <input type="hidden" name="guests" value={JSON.stringify(guests.map(({ key: _k, ...g }) => g))} />
      <fieldset className="a-fieldset" disabled={readOnly}>
        <legend>Convite</legend>
        <div className="a-form-grid">
          <label className="a-field">
            <span>Nome do convite *</span>
            <input className="a-input" name="label" required defaultValue={initial.label} placeholder="Família Silva / João e Maria" />
          </label>
          <label className="a-field">
            <span>Como saudar (opcional)</span>
            <input className="a-input" name="greetingName" defaultValue={initial.greetingName} placeholder="Automático: João, Maria e Pedro" />
          </label>
          <label className="a-field">
            <span>Tipo</span>
            <select className="a-select" name="kind" defaultValue={initial.kind}>
              <option value="individual">Individual</option>
              <option value="couple">Casal</option>
              <option value="family">Família</option>
              <option value="group">Grupo</option>
            </select>
          </label>
          <label className="a-field">
            <span>Grupo / categoria</span>
            <input className="a-input" name="groupName" list="groups-list" defaultValue={initial.groupName} placeholder="Família da noiva, Amigos…" />
            <datalist id="groups-list">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label className="a-field">
            <span>Telefone (WhatsApp)</span>
            <input className="a-input" name="phone" type="tel" defaultValue={initial.phone} placeholder="(98) 99999-9999" />
          </label>
          <label className="a-field">
            <span>E-mail</span>
            <input className="a-input" name="email" type="email" defaultValue={initial.email} />
          </label>
          <label className="a-field">
            <span>Modelo de WhatsApp</span>
            <select className="a-select" name="whatsappTemplateId" defaultValue={initial.whatsappTemplateId}>
              <option value="">Automático (pelo tipo do convite)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8, alignContent: 'end' }}>
            <label className="a-check">
              <input type="checkbox" name="isCloseFamily" defaultChecked={initial.isCloseFamily} />
              Familiares próximos
            </label>
            <label className="a-check">
              <input type="checkbox" name="allowCompanions" checked={allowCompanions} onChange={(e) => setAllowCompanions(e.target.checked)} />
              Pode levar acompanhante
            </label>
            {allowCompanions ? (
              <label className="a-field" style={{ maxWidth: 200 }}>
                <span>Quantidade máxima</span>
                <input className="a-input" name="maxCompanions" type="number" min={1} max={10} defaultValue={Math.max(1, initial.maxCompanions)} />
              </label>
            ) : null}
          </div>
          <label className="a-field span-2">
            <span>Observações internas</span>
            <textarea className="a-textarea" name="notes" rows={2} defaultValue={initial.notes} />
          </label>
        </div>
      </fieldset>

      <fieldset className="a-fieldset" disabled={readOnly}>
        <legend>Pessoas neste convite</legend>
        <div style={{ display: 'grid', gap: 10 }}>
          {guests.map((g, idx) => (
            <div key={g.key} className="a-card" style={{ padding: 12, margin: 0 }}>
              <div className="a-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <label className="a-field">
                  <span>Nome {idx === 0 ? '*' : ''}</span>
                  <input className="a-input" value={g.firstName} onChange={(e) => update(g.key, { firstName: e.target.value })} />
                </label>
                <label className="a-field">
                  <span>Sobrenome</span>
                  <input className="a-input" value={g.lastName} onChange={(e) => update(g.key, { lastName: e.target.value })} />
                </label>
                <label className="a-field">
                  <span>Telefone</span>
                  <input className="a-input" value={g.phone} onChange={(e) => update(g.key, { phone: e.target.value })} />
                </label>
                <label className="a-field">
                  <span>E-mail</span>
                  <input className="a-input" value={g.email} onChange={(e) => update(g.key, { email: e.target.value })} />
                </label>
                {!isNew ? (
                  <label className="a-field">
                    <span>Presença</span>
                    <select className="a-select" value={g.attendance} onChange={(e) => update(g.key, { attendance: e.target.value as GuestRow['attendance'] })}>
                      <option value="pending">Aguardando</option>
                      <option value="yes">Confirmado</option>
                      <option value="no">Não comparecerá</option>
                    </select>
                  </label>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <label className="a-check">
                  <input type="checkbox" checked={g.isChild} onChange={(e) => update(g.key, { isChild: e.target.checked })} />
                  Criança
                </label>
                {g.isCompanion ? <span className="a-badge">Acompanhante informado pelo convidado</span> : null}
                <button type="button" className="a-btn a-btn--sm a-btn--danger" style={{ marginLeft: 'auto' }} onClick={() => setGuests((list) => list.filter((x) => x.key !== g.key))} disabled={guests.length === 1}>
                  Remover
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="a-btn"
            style={{ justifySelf: 'start' }}
            onClick={() => setGuests((list) => [...list, { key: key(), firstName: '', lastName: '', phone: '', email: '', isChild: false, isCompanion: false, attendance: 'pending' }])}
          >
            + Adicionar pessoa
          </button>
          {!isNew ? (
            <p className="a-help">Alterar a presença aqui registra uma resposta manual no histórico (ex.: o convidado respondeu por telefone).</p>
          ) : null}
        </div>
      </fieldset>

      {state.error ? <p className="a-alert a-alert--bad">{state.error}</p> : null}
      {!readOnly ? (
        <div>
          <button className="a-btn a-btn--primary" disabled={pending}>
            {pending ? 'Salvando…' : isNew ? 'Criar convite' : 'Salvar alterações'}
          </button>
        </div>
      ) : null}
    </form>
  )
}
