'use client'

import { useActionState } from 'react'
import { changePasswordAction, createAdminAction, type TeamState } from './actions'

export function CreateAdminForm() {
  const [state, action, pending] = useActionState<TeamState, FormData>(createAdminAction, {})
  return (
    <form action={action} className="a-form">
      <div className="a-form-grid">
        <label className="a-field">
          <span>Nome</span>
          <input className="a-input" name="name" required />
        </label>
        <label className="a-field">
          <span>E-mail</span>
          <input className="a-input" type="email" name="email" required />
        </label>
        <label className="a-field">
          <span>Papel</span>
          <select className="a-select" name="role" defaultValue="editor">
            <option value="editor">Editor — gerencia convidados e conteúdo</option>
            <option value="viewer">Leitura — só visualiza</option>
            <option value="owner">Proprietário — tudo, inclusive equipe</option>
          </select>
        </label>
        <label className="a-field">
          <span>Senha inicial</span>
          <input className="a-input" type="password" name="password" required minLength={10} autoComplete="new-password" />
        </label>
      </div>
      {state.error ? <p className="a-alert a-alert--bad">{state.error}</p> : null}
      {state.ok ? <p className="a-alert a-alert--ok">{state.ok}</p> : null}
      <div>
        <button className="a-btn a-btn--primary" disabled={pending}>
          Criar acesso
        </button>
      </div>
    </form>
  )
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<TeamState, FormData>(changePasswordAction, {})
  return (
    <form action={action} className="a-form" style={{ maxWidth: 420 }}>
      <label className="a-field">
        <span>Senha atual</span>
        <input className="a-input" type="password" name="current" required autoComplete="current-password" />
      </label>
      <label className="a-field">
        <span>Nova senha (mín. 10 caracteres, letras e números)</span>
        <input className="a-input" type="password" name="next" required minLength={10} autoComplete="new-password" />
      </label>
      <label className="a-field">
        <span>Confirme a nova senha</span>
        <input className="a-input" type="password" name="confirm" required autoComplete="new-password" />
      </label>
      {state.error ? <p className="a-alert a-alert--bad">{state.error}</p> : null}
      {state.ok ? <p className="a-alert a-alert--ok">{state.ok}</p> : null}
      <div>
        <button className="a-btn a-btn--primary" disabled={pending}>
          Alterar senha
        </button>
      </div>
    </form>
  )
}
