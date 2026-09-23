'use client'

import { useActionState } from 'react'
import { sendGuestbookMessage, type GuestbookState } from './actions'

export function GuestbookForm({ defaultName, coupleNames }: { defaultName: string; coupleNames: string }) {
  const [state, action, pending] = useActionState<GuestbookState, FormData>(sendGuestbookMessage, {})

  if (state.ok) {
    return (
      <div className="result" role="status">
        <p className="script">Obrigado{state.name ? `, ${state.name.split(' ')[0]}` : ''}!</p>
        <p className="result__text">Sua mensagem chegou até nós e vai ficar guardada com muito carinho.</p>
        <p className="script" style={{ fontSize: '1.8rem', marginTop: 12 }}>
          {coupleNames}
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="form" noValidate>
      <div className="field">
        <label className="field__label" htmlFor="gb-name">
          Seu nome
        </label>
        <input id="gb-name" name="name" className="input" required maxLength={80} autoComplete="name" defaultValue={state.name ?? defaultName} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="gb-message">
          Sua mensagem
        </label>
        <textarea
          id="gb-message"
          name="message"
          className="textarea"
          required
          maxLength={2000}
          rows={6}
          placeholder="Um conselho, uma lembrança, um desejo…"
          defaultValue={state.message}
        />
      </div>
      <div className="honeypot" aria-hidden="true">
        <label>
          Não preencha
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.error ? (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar mensagem'}
      </button>
      <p className="privacy-note">
        Sua mensagem é lida somente pelos noivos. Veja nosso <a href="/privacidade">aviso de privacidade</a>.
      </p>
    </form>
  )
}
