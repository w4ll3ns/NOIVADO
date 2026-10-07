import type { Metadata } from 'next'
import Link from 'next/link'
import { Crest, Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { CoupleNames } from '@/components/site/CoupleNames'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { getOrder, syncPaymentWithMp } from '@/lib/payments/service'
import { formatBRL } from '@/lib/format'
import { rateLimit } from '@/lib/security/rate-limit'
import { AutoRefresh } from './AutoRefresh'
import { EsvaziarSacola, TentarDeNovo } from './Sacola'

export const metadata: Metadata = { title: 'Seu presente', robots: { index: false, follow: false } }

/**
 * Retorno do Mercado Pago. O status exibido vem SEMPRE do nosso banco
 * (atualizado pelo webhook ou por uma consulta do servidor à API) — nunca dos parâmetros da URL.
 */
export default async function GiftReturnPage(props: PageProps<'/presentes/retorno'>) {
  const sp = await props.searchParams
  const ref = typeof sp.ref === 'string' ? sp.ref : ''
  let order = await getOrder(ref)
  if (order && order.status === 'awaiting' && order.provider === 'mercadopago') {
    if (await rateLimit(`sync:${order.reference}`, 1, 5)) {
      await syncPaymentWithMp(order.reference, 'return')
      order = await getOrder(ref)
    }
  }
  const [settings, guest] = await Promise.all([getSettings(), getCurrentGuest()])
  const back = guest ? `/i/${guest.token}` : '/'

  return (
    <div className="container narrow" style={{ paddingBlock: 'clamp(40px, 9vw, 80px) var(--section-y)' }}>
      <AutoRefresh active={order?.status === 'awaiting'} />
      {order?.status === 'approved' || order?.status === 'awaiting' ? <EsvaziarSacola /> : null}
      <div className="paper paper--ornate center">
        <FrameCorners />
        <Crest />
        {!order ? (
          <div className="result">
            <h1 className="result__title">Não encontramos este presente</h1>
            <p className="result__text">Se você concluiu o pagamento, fique tranquilo: ele será confirmado automaticamente.</p>
          </div>
        ) : order.status === 'approved' ? (
          <div className="result">
            <h1 className="result__title">{settings.gifts.thanksTitle}</h1>
            <Divider />
            <p className="result__text">{settings.gifts.thanksText}</p>
            <ResumoPedido rows={order.rows} totalCents={order.totalCents} />
            <p className="script" style={{ marginTop: 18 }}>
              <CoupleNames names={settings.event.coupleNames} />
            </p>
          </div>
        ) : order.status === 'awaiting' ? (
          <div className="result">
            <h1 className="result__title">Estamos aguardando a confirmação</h1>
            <Divider />
            <p className="result__text">
              Assim que o Mercado Pago confirmar o pagamento, {order.rows.length === 1 ? 'ele aparece' : 'os presentes aparecem'} aqui e no seu
              convite. Pagando o Pix, isso leva só alguns instantes.
            </p>
            <ResumoPedido rows={order.rows} totalCents={order.totalCents} />
            {order.checkoutUrl ? (
              <p style={{ marginTop: 18 }}>
                <a className="btn btn--link" href={order.checkoutUrl}>
                  Voltar ao pagamento
                </a>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="result">
            <h1 className="result__title">O pagamento não foi concluído</h1>
            <Divider />
            <p className="result__text">
              {order.status === 'rejected'
                ? 'O Mercado Pago não aprovou esta tentativa. Você pode tentar novamente com outra forma de pagamento.'
                : order.status === 'refunded'
                  ? 'Este pagamento foi estornado.'
                  : 'O tempo para concluir este presente terminou. Se quiser, é só começar de novo.'}
            </p>
            <ResumoPedido rows={order.rows} totalCents={order.totalCents} />
            {order.status !== 'refunded' ? (
              <div className="btn-row" style={{ marginTop: 22 }}>
                <TentarDeNovo itens={order.rows.map((r) => ({ id: r.giftId, cents: r.amountCents }))} />
              </div>
            ) : null}
          </div>
        )}
        <div className="btn-row" style={{ marginTop: 18 }}>
          <Link href={back} className="btn">
            {guest ? 'Voltar ao meu convite' : 'Voltar ao início'}
          </Link>
          <Link href="/presentes" className="btn btn--link">
            Ver a lista de presentes
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Os presentes do pedido e o total. */
function ResumoPedido({ rows, totalCents }: { rows: { id: string; giftName: string; amountCents: number }[]; totalCents: number }) {
  return (
    <ul className="pedido-resumo">
      {rows.map((r) => (
        <li key={r.id}>
          <span>{r.giftName}</span>
          <span>{formatBRL(r.amountCents)}</span>
        </li>
      ))}
      {rows.length > 1 ? (
        <li className="pedido-resumo__total">
          <span>Total</span>
          <span>{formatBRL(totalCents)}</span>
        </li>
      ) : null}
    </ul>
  )
}
