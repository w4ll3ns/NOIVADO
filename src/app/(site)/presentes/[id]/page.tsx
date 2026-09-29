import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { EscolherPresente } from '@/components/gifts/EscolherPresente'
import { SacolaBarra } from '@/components/gifts/SacolaBarra'
import { getSettings } from '@/lib/settings'
import { getPublicGift } from '@/lib/gifts'
import { formatBRL } from '@/lib/format'
import { mediaUrl } from '@/lib/media'

export const metadata: Metadata = { title: 'Presentear' }

export default async function GiftPage(props: PageProps<'/presentes/[id]'>) {
  const { id } = await props.params
  const [settings, gift] = await Promise.all([getSettings(), getPublicGift(id)])
  if (!settings.gifts.enabled || !gift) notFound()
  const custom = gift.priceType === 'custom'

  return (
    <div className="container narrow" style={{ paddingBottom: 'var(--section-y)' }}>
      <p style={{ paddingTop: 24 }}>
        <Link href="/presentes" className="btn btn--link">
          ‹ Voltar à lista
        </Link>
      </p>
      <header className="page-head gift-detail" style={{ paddingTop: 20 }}>
        {gift.mediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(gift.mediaId, 'web')!} alt="" className="gift__media" style={{ margin: '0 auto 20px', maxWidth: 520 }} />
        ) : (
          <EngravedIcon name={gift.icon} />
        )}
        <h1 className="gift-detail__name">{gift.name}</h1>
        {gift.description ? <p className="gift-detail__desc">{gift.description}</p> : null}
        <Divider />
        {!custom ? <p className="gift-detail__value">{formatBRL(gift.amountCents)}</p> : null}
      </header>

      <div className="paper paper--ornate center">
        <FrameCorners />
        {gift.avail.available ? (
          <div className="gift-detail__escolha">
            <EscolherPresente id={gift.id} nome={gift.name} sugeridoCents={custom ? gift.suggestedCents : null} />
            <p className="result__text" style={{ marginTop: 14 }}>
              Escolha quantos presentes quiser e finalize tudo de uma vez{custom ? ' — o valor você define ao finalizar' : ''}.
            </p>
            <div className="btn-row" style={{ marginTop: 18 }}>
              <Link href="/presentes" className="btn">
                Ver outros presentes
              </Link>
            </div>
          </div>
        ) : (
          <div className="result">
            <p className="gift__given" style={{ fontSize: '1.5rem' }}>
              Já fomos presenteados ❤️
            </p>
            <p className="result__text">Obrigado pelo carinho! Que tal escolher outra ideia da lista?</p>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <Link href="/presentes" className="btn btn--primary">
                Ver outros presentes
              </Link>
            </div>
          </div>
        )}
      </div>
      {gift.avail.available ? <SacolaBarra precos={{ [gift.id]: { cents: gift.amountCents, livre: custom } }} /> : null}
    </div>
  )
}
