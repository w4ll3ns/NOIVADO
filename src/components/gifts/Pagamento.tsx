'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { formatBRL } from '@/lib/format'
import { formatCpf, isCpf } from '@/lib/cpf'
import type { PixView } from '@/lib/payments/service'
import type { FallbackState } from './pagarComCartao'

/** Dados da tela (vêm de dadosPagamento, no servidor). */
export type TelaPagamento = {
  orderRef: string
  totalCents: number
  maxInstallments: number
  pixAtual: PixView | null
  tentativaRecusada: boolean
}

type Props = TelaPagamento & {
  /** Cartão: abre a página do Mercado Pago para este pedido (pagarNoMercadoPago já com o pedido). */
  cartao: (prev: FallbackState) => Promise<FallbackState>
  /** Pago: o que fazer (padrão: ir para o agradecimento). */
  onPago?: () => void
}

type Metodo = 'pix' | 'cartao'

/**
 * Pix no próprio site (QR Code e copia e cola) e cartão de crédito na página do Mercado Pago, onde
 * o antifraude e a verificação do banco aprovam mais. Usado na página de pagamento e no modal do
 * "Finalizar presentes".
 */
export function Pagamento(props: Props) {
  const router = useRouter()
  const [metodo, setMetodo] = useState<Metodo>('pix')
  const { orderRef, onPago } = props
  const pago = useCallback(() => {
    if (onPago) onPago()
    else router.push(`/presentes/retorno?ref=${orderRef}`)
  }, [router, orderRef, onPago])

  return (
    <div className="pagamento__conteudo">
      {props.tentativaRecusada ? (
        <p className="notice" role="status">
          A tentativa anterior não foi aprovada. Você pode tentar de novo, com outro cartão ou com Pix.
        </p>
      ) : null}
      <div className="pagamento__metodos" role="tablist" aria-label="Forma de pagamento">
        {(['pix', 'cartao'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`tab-${m}`}
            aria-selected={metodo === m}
            aria-controls={`painel-${m}`}
            className="pagamento__metodo"
            onClick={() => setMetodo(m)}
          >
            {m === 'pix' ? <IconePix /> : <IconeCartao />}
            {m === 'pix' ? (
              'Pix'
            ) : (
              <span>
                Cartão<span className="pagamento__metodo-extra"> de crédito</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div id="painel-pix" role="tabpanel" aria-labelledby="tab-pix" hidden={metodo !== 'pix'}>
        <PainelPix orderRef={props.orderRef} totalCents={props.totalCents} inicial={props.pixAtual} ativo={metodo === 'pix'} onPago={pago} />
      </div>
      <div id="painel-cartao" role="tabpanel" aria-labelledby="tab-cartao" hidden={metodo !== 'cartao'}>
        <PainelCartao maxInstallments={props.maxInstallments} cartao={props.cartao} />
      </div>

      <p className="privacy-note">
        Pagamento processado pelo Mercado Pago. Os dados do cartão vão direto para o Mercado Pago e não passam pelo nosso site.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pix                                                                  */
/* ------------------------------------------------------------------ */

function PainelPix({
  orderRef,
  totalCents,
  inicial,
  ativo,
  onPago,
}: {
  orderRef: string
  totalCents: number
  inicial: PixView | null
  ativo: boolean
  onPago: () => void
}) {
  const [pix, setPix] = useState<PixView | null>(inicial)
  const [cpf, setCpf] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState<'ok' | 'manual' | null>(null)
  // A contagem só começa no navegador (o horário do servidor diferiria por alguns segundos).
  const [agora, setAgora] = useState<number | null>(null)
  const codigoRef = useRef<HTMLTextAreaElement>(null)

  const restante = pix?.expiresAt && agora !== null ? new Date(pix.expiresAt).getTime() - agora : null
  const expirou = restante !== null && restante <= 0

  // Contagem regressiva e verificação do pagamento (o webhook atualiza o pedido).
  useEffect(() => {
    if (!pix || expirou) return
    const tique = () => setAgora(Date.now())
    const primeiro = window.setTimeout(tique, 0)
    const relogio = window.setInterval(tique, 1000)
    let parar = false
    const verificar = async () => {
      if (parar || document.hidden) return
      const res = await fetch(`/api/presentes/pedido/${orderRef}`, { cache: 'no-store' }).catch(() => null)
      const data = res?.ok ? ((await res.json()) as { status?: string }) : null
      if (data?.status === 'approved') onPago()
    }
    const intervalo = window.setInterval(verificar, 4000)
    return () => {
      parar = true
      window.clearTimeout(primeiro)
      window.clearInterval(relogio)
      window.clearInterval(intervalo)
    }
  }, [pix, expirou, orderRef, onPago])

  const gerar = async () => {
    setErro(null)
    if (!isCpf(cpf)) return setErro('Confira o CPF: o Mercado Pago pede o CPF de quem paga o Pix.')
    setGerando(true)
    const res = await fetch('/api/presentes/pix', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ref: orderRef, cpf }),
    }).catch(() => null)
    const data = res ? ((await res.json().catch(() => null)) as (PixView & { error?: string }) | null) : null
    setGerando(false)
    if (!res?.ok || !data?.qrCode) return setErro(data?.error ?? 'Não conseguimos gerar o Pix agora. Tente de novo em instantes.')
    setPix(data)
  }

  const copiar = async () => {
    if (!pix) return
    let ok = false
    try {
      // Alguns navegadores deixam a permissão pendente: não espera mais que 1,5 s.
      await Promise.race([
        navigator.clipboard.writeText(pix.qrCode),
        new Promise((_, falha) => window.setTimeout(() => falha(new Error('sem resposta')), 1500)),
      ])
      ok = true
    } catch {
      const campo = codigoRef.current
      campo?.focus()
      campo?.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
    }
    setCopiado(ok ? 'ok' : 'manual')
    if (ok) window.setTimeout(() => setCopiado(null), 2500)
  }

  if (!pix || expirou) {
    return (
      <form
        className="pix-gerar"
        onSubmit={(e) => {
          e.preventDefault()
          void gerar()
        }}
      >
        {expirou ? (
          <p className="notice" role="status">
            O código Pix expirou. Gere um novo para concluir.
          </p>
        ) : (
          <p className="pagamento__texto">Pague na hora pelo app do seu banco, com o QR Code ou o código “copia e cola”.</p>
        )}
        <div className="field">
          <label className="field__label" htmlFor="pix-cpf">
            CPF de quem vai pagar
          </label>
          <input
            id="pix-cpf"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            required
          />
          <span className="field__hint">O Mercado Pago pede o CPF para gerar o Pix.</span>
        </div>
        {erro ? (
          <p className="notice notice--error" role="alert">
            {erro}
          </p>
        ) : null}
        <button type="submit" className="btn btn--primary btn--block" disabled={gerando || !ativo}>
          {gerando ? 'Gerando o Pix…' : `Gerar Pix · ${formatBRL(totalCents)}`}
        </button>
      </form>
    )
  }

  const min = restante !== null ? Math.floor(restante / 60000) : null
  const seg = restante !== null ? Math.floor((restante % 60000) / 1000) : null
  return (
    <div className="pix">
      <p className="pagamento__texto">Abra o app do seu banco, escolha pagar com Pix e escaneie o código, ou copie e cole o código abaixo.</p>
      {pix.qrBase64 ? (
        <figure className="pix__qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${pix.qrBase64}`} alt="QR Code do Pix" width={220} height={220} />
        </figure>
      ) : null}
      <p className="pix__valor">{formatBRL(totalCents)}</p>
      <label className="field__label" htmlFor="pix-codigo">
        Pix copia e cola
      </label>
      <textarea id="pix-codigo" ref={codigoRef} className="pix__codigo" readOnly rows={3} value={pix.qrCode} onFocus={(e) => e.target.select()} />
      <button type="button" className={`btn btn--primary btn--block pix__copiar${copiado === 'ok' ? ' is-ok' : ''}`} onClick={() => void copiar()}>
        {copiado === 'ok' ? 'Código copiado ✓' : 'Copiar código Pix'}
      </button>
      {copiado === 'manual' ? (
        <p className="field__hint" role="status">
          Selecionamos o código acima: toque e segure sobre ele e escolha “Copiar”.
        </p>
      ) : null}
      <p className="pix__status" role="status" aria-live="polite">
        <span className="pix__pulso" aria-hidden="true" />
        Aguardando o pagamento{min !== null ? ` · vale por ${min}:${String(seg).padStart(2, '0')}` : ''}
      </p>
      <p className="field__hint center">Assim que o Pix for pago, esta página continua sozinha.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cartão de crédito: na página do Mercado Pago                         */
/* ------------------------------------------------------------------ */

function PainelCartao({ maxInstallments, cartao }: { maxInstallments: number; cartao: Props['cartao'] }) {
  const [state, action, pending] = useActionState<FallbackState>(cartao, {})
  // Abre na janela inteira; ao concluir, o Mercado Pago traz o convidado de volta ao agradecimento.
  useEffect(() => {
    if (state.url) window.location.assign(state.url)
  }, [state])
  return (
    <form action={action} className="cartao-mp">
      <p className="pagamento__texto">
        O cartão de crédito é pago no ambiente seguro do Mercado Pago{maxInstallments > 1 ? `, em até ${maxInstallments}x` : ''}. Ao concluir,
        você volta para cá.
      </p>
      {state.error ? (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn--primary btn--block" disabled={pending || !!state.url}>
        {pending || state.url ? 'Abrindo o Mercado Pago…' : 'Pagar com cartão'}
      </button>
    </form>
  )
}

function IconePix() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.5l4.2 4.2-4.2 4.2-4.2-4.2zM12 13.1l4.2 4.2-4.2 4.2-4.2-4.2zM2.5 12l4.2-4.2 4.2 4.2-4.2 4.2zM13.1 12l4.2-4.2 4.2 4.2-4.2 4.2z" />
    </svg>
  )
}

function IconeCartao() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="2.5" y="5.5" width="19" height="13" rx="1.5" />
      <path d="M2.5 9.5h19M6 15h4" />
    </svg>
  )
}
