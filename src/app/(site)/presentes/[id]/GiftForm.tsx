'use client'

import { useActionState, useRef, useState } from 'react'
import type { GiftFormState } from './actions'

type Props = {
  action: (prev: GiftFormState, form: FormData) => Promise<GiftFormState>
  custom: boolean
  quickAmounts: number[]
  suggestedCents: number | null
  minCents: number | null
  maxCents: number | null
  defaults: { name: string; email: string; phone: string }
  coupleNames: string
}

const fmt = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100)

export function GiftForm(props: Props) {
  const [state, action, pending] = useActionState<GiftFormState, FormData>(props.action, {})
  const initial = state.values?.amount ?? (props.suggestedCents ? fmt(props.suggestedCents) : '')
  const [amount, setAmount] = useState(initial)
  const amountRef = useRef<HTMLInputElement>(null)
  const v = state.values

  return (
    <form action={action} className="form">
      {props.custom ? (
        <div className="field" style={{ textAlign: 'center' }}>
          <label className="field__label" htmlFor="g-amount">
            Quanto você gostaria de nos presentear?
          </label>
          {props.quickAmounts.length ? (
            <div className="quick-amounts" role="group" aria-label="Valores sugeridos" style={{ margin: '8px 0 6px' }}>
              {props.quickAmounts.map((c) => (
                <button key={c} type="button" aria-pressed={amount === fmt(c)} onClick={() => setAmount(fmt(c))}>
                  R$ {fmt(c)}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={!props.quickAmounts.some((c) => fmt(c) === amount)}
                onClick={() => {
                  setAmount('')
                  amountRef.current?.focus()
                }}
              >
                Outro valor
              </button>
            </div>
          ) : null}
          <div style={{ position: 'relative' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-title)', fontSize: '1.3rem', color: 'var(--taupe)' }}>
              R$
            </span>
            <input
              ref={amountRef}
              id="g-amount"
              name="amount"
              className="input input--money"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            />
          </div>
          <p className="field__hint">
            {props.minCents ? `A partir de R$ ${fmt(props.minCents)}` : null}
            {props.minCents && props.maxCents ? ' · ' : null}
            {props.maxCents ? `até R$ ${fmt(props.maxCents)}` : null}
          </p>
        </div>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor="g-name">
          Seu nome
        </label>
        <input id="g-name" name="name" className="input" required maxLength={100} autoComplete="name" defaultValue={v?.name ?? props.defaults.name} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="g-email">
          E-mail
        </label>
        <input id="g-email" name="email" type="email" className="input" required maxLength={200} autoComplete="email" inputMode="email" defaultValue={v?.email ?? props.defaults.email} />
        <span className="field__hint">Para o comprovante do Mercado Pago.</span>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="g-phone">
          Telefone <span className="field__hint">(opcional)</span>
        </label>
        <input id="g-phone" name="phone" type="tel" className="input" maxLength={30} autoComplete="tel" inputMode="tel" defaultValue={v?.phone ?? props.defaults.phone} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="g-message">
          Mensagem aos noivos <span className="field__hint">(opcional)</span>
        </label>
        <textarea id="g-message" name="message" className="textarea" rows={4} maxLength={1500} placeholder={`Um recado para ${props.coupleNames}…`} defaultValue={v?.message} />
      </div>

      {state.error ? (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
        {pending ? 'Preparando…' : 'Presentear'}
      </button>
      <p className="privacy-note">
        Você será direcionado ao ambiente seguro do Mercado Pago para concluir com Pix, cartão ou boleto. Não recebemos dados do seu cartão.
      </p>
    </form>
  )
}
