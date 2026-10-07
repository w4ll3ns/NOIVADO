'use client'

import Link from 'next/link'
import { useActionState, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { FrameCorners } from '@/components/ornaments/Ornaments'
import { assinarSacola, definirValor, sacola, sacolaNoServidor, substituirSacola, tirar } from '@/components/gifts/sacola'
import { ModalPagamento } from '@/components/gifts/ModalPagamento'
import type { TelaPagamento } from '@/components/gifts/Pagamento'
import { formatBRLShort, parseBRLToCents } from '@/lib/format'
import type { FinalizarState } from './actions'

export type PresenteInfo = {
  id: string
  nome: string
  imagem: string | null
  icone: string | null
  livre: boolean
  cents: number | null
  minCents: number | null
  maxCents: number | null
  sugestoes: number[]
  disponivel: boolean
}

type Props = {
  presentes: PresenteInfo[]
  action: (prev: FinalizarState, form: FormData) => Promise<FinalizarState>
  defaults: { name: string; email: string; phone: string }
  coupleNames: string
}

/** 150 / 150,50 (sem "R$"), para o campo de valor. */
const numero = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100)

function foraDoLimite(p: PresenteInfo, cents: number | null) {
  if (!cents) return 'Defina o valor.'
  const min = Math.max(100, p.minCents ?? 100)
  if (cents < min) return `O mínimo é ${formatBRLShort(min)}.`
  if (p.maxCents && cents > p.maxCents) return `O máximo é ${formatBRLShort(p.maxCents)}.`
  return null
}

export function Finalizar({ presentes, action, defaults, coupleNames }: Props) {
  const itens = useSyncExternalStore(assinarSacola, sacola, sacolaNoServidor)
  const [montado, setMontado] = useState(false)
  const [avisos, setAvisos] = useState<string[]>([])
  const [state, formAction, pending] = useActionState<FinalizarState, FormData>(action, {})
  const mapa = new Map(presentes.map((p) => [p.id, p]))

  useEffect(() => setMontado(true), [])

  // Pagamento no site: o pedido abre no modal. Fechou e clicou de novo sem mudar nada? Reabre o
  // mesmo pedido, sem passar pelo servidor (o Pix gerado continua lá).
  const [modal, setModal] = useState<{ tela: TelaPagamento; chave: string; versao: number } | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const chaveEnviada = useRef('')
  const fecharModal = useCallback(() => setModalAberto(false), [])

  // Pedido criado: abre o modal, ou a página de pagamento com carregamento completo (FinalizarState.ir).
  const [saindo, setSaindo] = useState(false)
  useEffect(() => {
    if (state.pagar) {
      setModal((m) => ({ tela: state.pagar!, chave: chaveEnviada.current, versao: (m?.versao ?? 0) + 1 }))
      setModalAberto(true)
    } else if (state.ir) {
      setSaindo(true)
      window.location.assign(state.ir)
    }
  }, [state])
  // Voltou do pagamento pelo "voltar" do navegador (página restaurada da memória): libera o botão.
  useEffect(() => {
    const voltou = (e: PageTransitionEvent) => e.persisted && setSaindo(false)
    window.addEventListener('pageshow', voltou)
    return () => window.removeEventListener('pageshow', voltou)
  }, [])

  // O que não está mais disponível sai da lista (ao abrir a página e quando o servidor avisar).
  const indisponiveis = state.indisponiveis
  useEffect(() => {
    if (!montado) return
    const fora = sacola().filter((i) => !mapa.get(i.id)?.disponivel || indisponiveis?.includes(i.id))
    if (!fora.length) return
    setAvisos(fora.map((i) => mapa.get(i.id)?.nome ?? 'Um presente que saiu da lista'))
    substituirSacola(sacola().filter((i) => !fora.includes(i)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montado, indisponiveis])

  if (!montado) return <div style={{ minHeight: 240 }} aria-busy="true" />

  const lista = itens.map((i) => ({ item: i, p: mapa.get(i.id) })).filter((x): x is { item: typeof x.item; p: PresenteInfo } => !!x.p?.disponivel)
  if (!lista.length) {
    return (
      <div className="paper paper--ornate center">
        <FrameCorners />
        {avisos.length ? <AvisoIndisponiveis nomes={avisos} /> : null}
        <p className="result__text">Você ainda não escolheu nenhum presente.</p>
        <div className="btn-row" style={{ marginTop: 20 }}>
          <Link href="/presentes" className="btn btn--primary">
            Ver a lista de presentes
          </Link>
        </div>
      </div>
    )
  }

  const valorDe = (x: (typeof lista)[number]) => (x.p.livre ? x.item.cents : x.p.cents) ?? 0
  const total = lista.reduce((s, x) => s + valorDe(x), 0)
  const pendentes = lista.filter((x) => x.p.livre && foraDoLimite(x.p, x.item.cents))
  const v = state.values

  return (
    <>
      {avisos.length ? <AvisoIndisponiveis nomes={avisos} /> : null}
      <ul className="sacola-lista" aria-label="Presentes escolhidos">
        {lista.map(({ item, p }) => (
          <li key={p.id} className="sacola-item">
            <div className="sacola-item__img" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.imagem ? <img src={p.imagem} alt="" loading="lazy" decoding="async" /> : <EngravedIcon name={p.icone} />}
            </div>
            <div className="sacola-item__info">
              <p className="sacola-item__nome">{p.nome}</p>
              {p.livre ? <ValorLivre p={p} cents={item.cents} /> : <p className="sacola-item__valor">{formatBRLShort(p.cents)}</p>}
            </div>
            <button type="button" className="sacola-item__tirar" onClick={() => tirar(p.id)} aria-label={`Tirar ${p.nome} da lista`} title="Tirar da lista">
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="sacola-total">
        <span>Total</span>
        <strong>{formatBRLShort(total)}</strong>
      </div>
      <p className="center" style={{ margin: '4px 0 28px' }}>
        <Link href="/presentes" className="btn btn--link">
          + Escolher mais presentes
        </Link>
      </p>

      <div className="paper paper--ornate">
        <FrameCorners />
        <form
          action={formAction}
          className="form"
          onSubmit={(e) => {
            const chave = JSON.stringify([...new FormData(e.currentTarget).entries()])
            chaveEnviada.current = chave
            if (modal?.chave !== chave) return
            e.preventDefault()
            setModalAberto(true)
          }}
        >
          <input type="hidden" name="itens" value={JSON.stringify(lista.map(({ item }) => item))} />
          <p className="paper__title">Seus dados</p>
          <div className="field">
            <label className="field__label" htmlFor="f-name">
              Seu nome
            </label>
            <input id="f-name" name="name" className="input" required maxLength={100} autoComplete="name" defaultValue={v?.name ?? defaults.name} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="f-email">
              E-mail
            </label>
            <input id="f-email" name="email" type="email" className="input" required maxLength={200} autoComplete="email" inputMode="email" defaultValue={v?.email ?? defaults.email} />
            <span className="field__hint">Para o comprovante do Mercado Pago.</span>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="f-phone">
              Telefone <span className="field__hint">(opcional)</span>
            </label>
            <input id="f-phone" name="phone" type="tel" className="input" maxLength={30} autoComplete="tel" inputMode="tel" defaultValue={v?.phone ?? defaults.phone} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="f-message">
              Mensagem aos noivos <span className="field__hint">(opcional)</span>
            </label>
            <textarea id="f-message" name="message" className="textarea" rows={4} maxLength={1500} placeholder={`Um recado para ${coupleNames}…`} defaultValue={v?.message} />
          </div>

          {state.error && !state.indisponiveis ? (
            <p className="notice notice--error" role="alert">
              {state.error}
            </p>
          ) : null}
          {pendentes.length ? (
            <p className="notice" role="status">
              Defina o valor de {pendentes.map((x) => `“${x.p.nome}”`).join(', ')} para continuar.
            </p>
          ) : null}

          <button type="submit" className="btn btn--primary btn--block" disabled={pending || saindo || pendentes.length > 0}>
            {pending || saindo ? 'Preparando…' : 'Ir para o pagamento'}
          </button>
          <p className="privacy-note">
            Um só pagamento para todos os presentes, no ambiente seguro do Mercado Pago: Pix ou cartão de crédito. Não recebemos dados do seu cartão.
          </p>
        </form>
      </div>
      {modal ? <ModalPagamento key={modal.versao} tela={modal.tela} aberto={modalAberto} onFechar={fecharModal} /> : null}
    </>
  )
}

function AvisoIndisponiveis({ nomes }: { nomes: string[] }) {
  return (
    <p className="notice notice--error" role="alert" style={{ marginBottom: 20 }}>
      {nomes.length === 1 ? `“${nomes[0]}” acabou de ser escolhido por outra pessoa e saiu da sua lista.` : `Estes presentes acabaram de ser escolhidos por outras pessoas e saíram da sua lista: ${nomes.map((n) => `“${n}”`).join(', ')}.`}
    </p>
  )
}

/** Valor de um presente de valor livre: sugestões rápidas + campo. */
function ValorLivre({ p, cents }: { p: PresenteInfo; cents: number | null }) {
  const [texto, setTexto] = useState(cents ? numero(cents) : '')
  const erro = texto ? foraDoLimite(p, cents) : null
  const mudar = (t: string) => {
    setTexto(t)
    const c = parseBRLToCents(t)
    definirValor(p.id, c && c > 0 ? c : null)
  }
  return (
    <div className="sacola-livre">
      {p.sugestoes.length ? (
        <div className="quick-amounts quick-amounts--pequeno" role="group" aria-label={`Valores sugeridos para ${p.nome}`}>
          {p.sugestoes.map((c) => (
            <button key={c} type="button" aria-pressed={cents === c} onClick={() => mudar(numero(c))}>
              {formatBRLShort(c)}
            </button>
          ))}
        </div>
      ) : null}
      <label className="sacola-livre__campo">
        <span aria-hidden="true">R$</span>
        <input
          className="input input--money"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          aria-label={`Valor para ${p.nome}`}
          value={texto}
          onChange={(e) => mudar(e.target.value.replace(/[^\d.,]/g, ''))}
        />
      </label>
      <span className={`field__hint${erro ? ' sacola-livre__erro' : ''}`}>
        {erro ??
          [p.minCents ? `A partir de ${formatBRLShort(p.minCents)}` : null, p.maxCents ? `até ${formatBRLShort(p.maxCents)}` : null]
            .filter(Boolean)
            .join(' · ')}
      </span>
    </div>
  )
}
