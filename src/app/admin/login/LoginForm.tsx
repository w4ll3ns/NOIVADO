'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from './actions'

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {})
  return (
    <form action={action} className="a-form" style={{ textAlign: 'left', marginTop: 20 }}>
      <input type="hidden" name="next" value={next} />
      <label className="a-field">
        <span>E-mail</span>
        <input className="a-input" type="email" name="email" required autoComplete="username" defaultValue={state.email} />
      </label>
      <label className="a-field">
        <span>Senha</span>
        <input className="a-input" type="password" name="password" required autoComplete="current-password" />
      </label>
      {state.error ? (
        <p className="a-alert a-alert--bad" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="a-btn a-btn--primary" disabled={pending} style={{ minHeight: 44 }}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
