import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { ResumoPedido } from '@/components/gifts/ResumoPedido'
import { getSettings } from '@/lib/settings'
import { env } from '@/lib/env'
import { currentPix, getOrder, orderReadyToPay, PaymentError, transparentCheckout } from '@/lib/payments/service'
import { TentarDeNovo } from '../../retorno/Sacola'
import { Pagamento } from './Pagamento'
import { pagarNoMercadoPago } from './actions'

export const metadata: Metadata = { title: 'Pagamento', robots: { index: false, follow: false } }

/** Pagamento sem sair do site: Pix (QR Code e copia e cola) ou cartão de crédito. */
export default async function PagamentoPage(props: PageProps<'/presentes/pagamento/[ref]'>) {
  const { ref } = await props.params
  const settings = await getSettings()
  if (!settings.gifts.enabled) notFound()
  const order = await getOrder(ref)
  if (!order || order.provider !== 'mercadopago') notFound()
  if (order.status === 'approved' || order.status === 'refunded') redirect(`/presentes/retorno?ref=${order.reference}`)

  let problem: string | null = null
  try {
    await orderReadyToPay(ref)
  } catch (err) {
    if (!(err instanceof PaymentError)) throw err
    problem = err.message
  }
  const pix = problem ? null : await currentPix(order)
  const first = order.rows[0]

  return (
    <div className="container narrow" style={{ paddingBottom: 'var(--section-y)' }}>
      <p style={{ paddingTop: 24 }}>
        <Link href="/presentes/finalizar" className="btn btn--link">
          ‹ Voltar aos seus presentes
        </Link>
      </p>
      <header className="page-head" style={{ paddingTop: 12 }}>
        <span className="eyebrow">Com carinho</span>
        <h1 className="section-title">Pagamento</h1>
        <Divider />
      </header>
      <ResumoPedido rows={order.rows} totalCents={order.totalCents} />

      <div className="paper paper--ornate pagamento">
        <FrameCorners />
        {problem ? (
          <div className="result">
            <p className="notice notice--error" role="alert">
              {problem}
            </p>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <TentarDeNovo itens={order.rows.map((r) => ({ id: r.giftId, cents: r.amountCents }))} rotulo="Escolher de novo" />
            </div>
          </div>
        ) : (
          <Pagamento
            orderRef={order.reference}
            totalCents={order.totalCents}
            publicKey={transparentCheckout() ? env.mpPublicKey : null}
            email={first.payerEmail}
            maxInstallments={settings.gifts.maxInstallments}
            pixAtual={pix}
            tentativaRecusada={order.status === 'rejected'}
            fallback={pagarNoMercadoPago.bind(null, order.reference)}
          />
        )}
      </div>
    </div>
  )
}
