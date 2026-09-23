'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import type { RsvpState } from './actions'

type GuestItem = { id: string; name: string; attendance: 'pending' | 'yes' | 'no' }

type Props = {
  action: (prev: RsvpState, form: FormData) => Promise<RsvpState>
  token: string
  guests: GuestItem[]
  companions: string[]
  maxCompanions: number
  questions: { dietary: boolean; specialNeeds: boolean; notes: boolean; song: boolean; message: boolean }
  previous: { dietary: string; specialNeeds: string; notes: string; song: string }
  texts: { intro: string; confirmed: string; declined: string }
  preview: boolean
  giftsEnabled: boolean
}

export function RsvpForm(props: Props) {
  const [state, formAction, pending] = useActionState<RsvpState, FormData>(props.action, {})
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(props.guests.filter((g) => g.attendance !== 'pending').map((g) => [g.id, g.attendance])),
  )
  const [companions, setCompanions] = useState<string[]>(props.companions)
  const anyYes = Object.values(choices).includes('yes')
  const hasQuestions = Object.values(props.questions).some(Boolean)

  if (state.ok) {
    const yes = state.status === 'attending'
    return (
      <div className="result" role="status">
        <div className={`seal ${yes ? 'seal--ok' : 'seal--no'}`}>
          <span className="seal__mark" aria-hidden="true">
            {yes ? '✓' : '—'}
          </span>
          {yes ? 'Presença confirmada' : 'Resposta registrada'}
        </div>
        <p className="script">{yes ? 'Que alegria!' : 'Obrigado por avisar'}</p>
        <p className="result__text">{yes ? props.texts.confirmed : props.texts.declined}</p>
        <div className="btn-row" style={{ marginTop: 28 }}>
          <Link href={`/i/${props.token}`} className="btn btn--primary">
            Voltar ao meu convite
          </Link>
          {props.giftsEnabled ? (
            <Link href="/presentes" className="btn">
              Ver presentes
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="form">
      {props.preview ? <input type="hidden" name="preview" value="1" /> : null}
      <p className="section-lead" style={{ fontSize: '1.15rem' }}>
        {props.texts.intro}
      </p>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Presença de cada pessoa</legend>
        {props.guests.map((g) => (
          <div key={g.id} className="person" role="radiogroup" aria-label={g.name}>
            <p className="person__name">{g.name}</p>
            <div className="choice">
              <label className="choice__option">
                <input
                  type="radio"
                  name={`att_${g.id}`}
                  value="yes"
                  required
                  checked={choices[g.id] === 'yes'}
                  onChange={() => setChoices((c) => ({ ...c, [g.id]: 'yes' }))}
                />
                <span className="choice__label">Estarei presente</span>
              </label>
              <label className="choice__option choice__option--no">
                <input
                  type="radio"
                  name={`att_${g.id}`}
                  value="no"
                  checked={choices[g.id] === 'no'}
                  onChange={() => setChoices((c) => ({ ...c, [g.id]: 'no' }))}
                />
                <span className="choice__label">Não poderei comparecer</span>
              </label>
            </div>
          </div>
        ))}
      </fieldset>

      {props.maxCompanions > 0 && anyYes ? (
        <fieldset className="disclosure" style={{ padding: '16px 18px 20px' }}>
          <legend className="field__label" style={{ padding: '0 6px' }}>
            {props.maxCompanions === 1 ? 'Acompanhante' : `Acompanhantes (até ${props.maxCompanions})`}
          </legend>
          <p className="field__hint" style={{ marginBottom: 12 }}>
            Seu convite inclui {props.maxCompanions === 1 ? 'um acompanhante' : `até ${props.maxCompanions} acompanhantes`}. Conte para nós quem virá com você.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {companions.map((name, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  name="companion"
                  aria-label={`Nome do acompanhante ${i + 1}`}
                  placeholder="Nome e sobrenome"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setCompanions((list) => list.map((v, j) => (j === i ? e.target.value : v)))}
                />
                <button
                  type="button"
                  className="btn btn--small"
                  aria-label="Remover acompanhante"
                  onClick={() => setCompanions((list) => list.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            {companions.length < props.maxCompanions ? (
              <button type="button" className="btn btn--link" style={{ justifySelf: 'start' }} onClick={() => setCompanions((l) => [...l, ''])}>
                + Adicionar acompanhante
              </button>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {hasQuestions ? (
        <details className="disclosure" open={!!(props.previous.dietary || props.previous.specialNeeds || props.previous.notes || props.previous.song)}>
          <summary>
            <span>Algo que devemos saber?</span>
            <span>opcional</span>
          </summary>
          <div className="disclosure__body">
            {props.questions.dietary ? (
              <div className="field">
                <label className="field__label" htmlFor="r-dietary">
                  Restrição alimentar
                </label>
                <input id="r-dietary" name="dietary" className="input" maxLength={500} placeholder="Ex.: Maria é vegetariana" defaultValue={props.previous.dietary} />
              </div>
            ) : null}
            {props.questions.specialNeeds ? (
              <div className="field">
                <label className="field__label" htmlFor="r-needs">
                  Necessidade especial / acessibilidade
                </label>
                <input id="r-needs" name="specialNeeds" className="input" maxLength={500} defaultValue={props.previous.specialNeeds} />
              </div>
            ) : null}
            {props.questions.song ? (
              <div className="field">
                <label className="field__label" htmlFor="r-song">
                  Uma música que não pode faltar
                </label>
                <input id="r-song" name="song" className="input" maxLength={160} placeholder="Artista — música" defaultValue={props.previous.song} />
              </div>
            ) : null}
            {props.questions.notes ? (
              <div className="field">
                <label className="field__label" htmlFor="r-notes">
                  Observações
                </label>
                <textarea id="r-notes" name="notes" className="textarea" rows={3} maxLength={1000} defaultValue={props.previous.notes} />
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {props.questions.message ? (
        <div className="field">
          <label className="field__label" htmlFor="r-message">
            Mensagem aos noivos <span className="field__hint">(opcional)</span>
          </label>
          <textarea id="r-message" name="message" className="textarea" rows={4} maxLength={2000} placeholder="Escreva algo para Maby & Chris…" />
        </div>
      ) : null}

      {state.error ? (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar resposta'}
      </button>
      <p className="privacy-note">
        Usamos essas informações apenas para preparar o evento. <a href="/privacidade">Privacidade</a>.
      </p>
    </form>
  )
}
