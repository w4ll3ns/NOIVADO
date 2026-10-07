'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { formatBRL } from '@/lib/format'
import { formatCpf, isCpf } from '@/lib/cpf'
import type { PixView } from '@/lib/payments/service'
import type { FallbackState } from './actions'

type Props = {
  orderRef: string
  totalCents: number
  /** Sem a chave pública só existe o plano B (página do Mercado Pago). */
  publicKey: string | null
  email: string
  maxInstallments: number
  pixAtual: PixView | null
  tentativaRecusada: boolean
  fallback: (prev: FallbackState) => Promise<FallbackState>
}

type Metodo = 'pix' | 'cartao'

export function Pagamento(props: Props) {
  const router = useRouter()
  const [metodo, setMetodo] = useState<Metodo>('pix')
  /** O formulário do Mercado Pago só carrega quando o convidado escolhe cartão (e continua montado). */
  const [cartaoAberto, setCartaoAberto] = useState(false)
  const pago = useCallback(() => router.push(`/presentes/retorno?ref=${props.orderRef}`), [router, props.orderRef])

  if (!props.publicKey) return <PlanoB fallback={props.fallback} motivo={null} />

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
            onClick={() => {
              setMetodo(m)
              if (m === 'cartao') setCartaoAberto(true)
            }}
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
        {cartaoAberto ? <PainelCartao {...props} onPago={pago} /> : null}
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
/* Cartão de crédito (formulário seguro do Mercado Pago)                */
/* ------------------------------------------------------------------ */

type CardFormData = {
  token: string
  issuer_id?: string | number
  payment_method_id: string
  transaction_amount: number
  installments: number
  payer: { email?: string; identification?: { type: string; number: string } }
}
type BrickController = { unmount: () => void }
type MpSdk = {
  bricks: () => { create: (name: 'cardPayment', container: string, settings: unknown) => Promise<BrickController> }
}
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MpSdk
    MP_DEVICE_SESSION_ID?: string
  }
}

/** Carrega um script externo uma única vez (a CSP desta página libera os domínios do Mercado Pago). */
function carregarScript(src: string, attrs: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existente?.dataset.carregado) return resolve()
    const s = existente ?? document.createElement('script')
    s.addEventListener('load', () => {
      s.dataset.carregado = '1'
      resolve()
    })
    s.addEventListener('error', () => reject(new Error(`não carregou ${src}`)))
    if (!existente) {
      s.src = src
      s.async = true
      for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v)
      document.head.appendChild(s)
    }
  })
}

function PainelCartao({ orderRef, totalCents, publicKey, email, maxInstallments, fallback, onPago }: Props & { onPago: () => void }) {
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'falhou'>('carregando')
  const [erro, setErro] = useState<string | null>(null)
  const [rodada, setRodada] = useState(0)
  const container = `cartao-mp-${rodada}`

  useEffect(() => {
    let cancelado = false
    let controle: BrickController | null = null
    const tempo = window.setTimeout(() => !cancelado && setEstado((e) => (e === 'carregando' ? 'falhou' : e)), 20_000)
    const montar = async () => {
      // Device ID antifraude do Mercado Pago (melhora a aprovação); se falhar, segue sem ele.
      void carregarScript('https://www.mercadopago.com/v2/security.js', { view: 'checkout' }).catch(() => {})
      await carregarScript('https://sdk.mercadopago.com/js/v2')
      if (cancelado || !window.MercadoPago || !publicKey) throw new Error('SDK indisponível')
      const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
      controle = await mp.bricks().create('cardPayment', container, {
        initialization: { amount: totalCents / 100, payer: { email } },
        customization: {
          visual: {
            style: {
              theme: 'default',
              customVariables: {
                baseColor: '#7c6855',
                baseColorFirstVariant: '#62503f',
                baseColorSecondVariant: '#b1a190',
                textPrimaryColor: '#4e3e31',
                textSecondaryColor: '#6b5a4b',
                inputBackgroundColor: '#fffdfa',
                formBackgroundColor: '#fcf7f2',
                outlinePrimaryColor: '#7c6855',
                outlineSecondaryColor: '#cdbba9',
                buttonTextColor: '#fcf7f2',
                errorColor: '#9a3b2e',
                borderRadiusSmall: '2px',
                borderRadiusMedium: '2px',
                borderRadiusLarge: '4px',
              },
            },
          },
          paymentMethods: { maxInstallments },
        },
        callbacks: {
          onReady: () => !cancelado && setEstado('pronto'),
          onSubmit: (formData: CardFormData) => pagar(formData),
          onError: (error: { type?: string; message?: string }) => {
            console.error('Formulário do Mercado Pago', error)
            if (error?.type === 'critical' && !cancelado) setEstado('falhou')
          },
        },
      })
      if (cancelado) controle.unmount()
    }
    const pagar = async (formData: CardFormData) => {
      setErro(null)
      const res = await fetch('/api/presentes/cartao', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref: orderRef, attempt: crypto.randomUUID(), deviceId: window.MP_DEVICE_SESSION_ID ?? null, formData }),
      }).catch(() => null)
      const data = res ? ((await res.json().catch(() => null)) as { status?: string; message?: string | null; error?: string } | null) : null
      if (res?.ok && (data?.status === 'approved' || data?.status === 'awaiting')) return onPago()
      setErro(data?.message ?? data?.error ?? 'Não conseguimos concluir agora. Tente de novo em instantes ou pague com Pix.')
      // Formulário novo para a próxima tentativa (o token do cartão é de uso único).
      setEstado('carregando')
      setRodada((r) => r + 1)
    }
    montar().catch((err) => {
      console.error(err)
      if (!cancelado) setEstado('falhou')
    })
    return () => {
      cancelado = true
      window.clearTimeout(tempo)
      controle?.unmount()
    }
  }, [container, orderRef, totalCents, publicKey, email, maxInstallments, onPago])

  return (
    <div className="cartao">
      {erro ? (
        <p className="notice notice--error" role="alert">
          {erro}
        </p>
      ) : null}
      {estado === 'falhou' ? (
        <PlanoB fallback={fallback} motivo="Não conseguimos carregar o formulário do cartão aqui." />
      ) : (
        <>
          {estado === 'carregando' ? (
            <p className="cartao__carregando" role="status">
              <span className="pix__pulso" aria-hidden="true" />
              Carregando o formulário seguro do Mercado Pago…
            </p>
          ) : null}
          <div id={container} key={container} className="cartao__brick" />
        </>
      )}
    </div>
  )
}

/** Página do Mercado Pago: quando o pagamento aqui não está disponível. */
function PlanoB({ fallback, motivo }: { fallback: Props['fallback']; motivo: string | null }) {
  const [state, action, pending] = useActionState<FallbackState>(fallback, {})
  return (
    <form action={action} className="plano-b">
      {motivo ? <p className="pagamento__texto">{motivo}</p> : null}
      <p className="pagamento__texto">Você pode concluir com Pix ou cartão no ambiente seguro do Mercado Pago.</p>
      {state.error ? (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
        {pending ? 'Abrindo…' : 'Pagar no site do Mercado Pago'}
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
