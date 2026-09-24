import type { Metadata } from 'next'
import Link from 'next/link'
import { Crest, Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { CoupleNames } from '@/components/site/CoupleNames'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { getPaymentById, syncPaymentWithMp } from '@/lib/payments/service'
import { formatBRL } from '@/lib/format'
import { rateLimit } from '@/lib/security/rate-limit'
import { AutoRefresh } from './AutoRefresh'

export const metadata: Metadata = { title: 'Seu presente', robots: { index: false, follow: false } }

/**
 * Retorno do Mercado Pago. O status exibido vem SEMPRE do nosso banco
 * (atualizado pelo webhook ou por uma consulta do servidor à API) — nunca dos parâmetros da URL.
 */
export default async function GiftReturnPage(props: PageProps<'/presentes/retorno'>) {
  const sp = await props.searchParams
  const ref = typeof sp.ref === 'string' ? sp.ref : ''
  let payment = await getPaymentById(ref)
  if (payment && payment.status === 'awaiting' && payment.provider === 'mercadopago') {
    if (await rateLimit(`sync:${payment.id}`, 1, 5)) {
      await syncPaymentWithMp(payment.id, 'return')
      payment = await getPaymentById(ref)
    }
  }
  const [settings, guest] = await Promise.all([getSettings(), getCurrentGuest()])
  const back = guest ? `/i/${guest.token}` : '/'

  return (
    <div className="container narrow" style={{ paddingBlock: 'clamp(40px, 9vw, 80px) var(--section-y)' }}>
      <AutoRefresh active={payment?.status === 'awaiting'} />
      <div className="paper paper--ornate center">
        <FrameCorners />
        <Crest />
        {!payment ? (
          <div className="result">
            <h1 className="result__title">Não encontramos este presente</h1>
            <p className="result__text">Se você concluiu o pagamento, fique tranquilo: ele será confirmado automaticamente.</p>
          </div>
        ) : payment.status === 'approved' ? (
          <div className="result">
            <h1 className="result__title">{settings.gifts.thanksTitle}</h1>
            <Divider />
            <p className="result__text">{settings.gifts.thanksText}</p>
            <p className="muted" style={{ marginTop: 18 }}>
              {payment.giftName} · {formatBRL(payment.amountCents)}
            </p>
            <p className="script" style={{ marginTop: 18 }}>
              <CoupleNames names={settings.event.coupleNames} />
            </p>
          </div>
        ) : payment.status === 'awaiting' ? (
          <div className="result">
            <h1 className="result__title">Estamos aguardando a confirmação</h1>
            <Divider />
            <p className="result__text">
              Assim que o Mercado Pago confirmar o pagamento de <strong>{payment.giftName}</strong>, ele aparece aqui e no seu convite.
              Para Pix, isso leva só alguns instantes; boletos podem levar até 3 dias úteis.
            </p>
            {payment.checkoutUrl ? (
              <p style={{ marginTop: 18 }}>
                <a className="btn btn--link" href={payment.checkoutUrl}>
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
              {payment.status === 'rejected'
                ? 'O Mercado Pago não aprovou esta tentativa. Você pode tentar novamente com outra forma de pagamento.'
                : payment.status === 'refunded'
                  ? 'Este pagamento foi estornado.'
                  : 'O tempo para concluir este presente terminou. Se quiser, é só começar de novo.'}
            </p>
            <div className="btn-row" style={{ marginTop: 22 }}>
              <Link href={`/presentes/${payment.giftId}`} className="btn btn--primary">
                Tentar novamente
              </Link>
            </div>
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
