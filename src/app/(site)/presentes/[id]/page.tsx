import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { getPublicGift } from '@/lib/gifts'
import { formatBRL, formatPhone, fullName } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import { GiftForm } from './GiftForm'
import { giveGiftAction } from './actions'

export const metadata: Metadata = { title: 'Presentear' }

export default async function GiftPage(props: PageProps<'/presentes/[id]'>) {
  const { id } = await props.params
  const [settings, gift, guest] = await Promise.all([getSettings(), getPublicGift(id), getCurrentGuest()])
  if (!settings.gifts.enabled || !gift) notFound()
  const first = guest?.guests.find((g) => !g.isCompanion)
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

      <div className="paper paper--ornate">
        <FrameCorners />
        {gift.avail.available ? (
          <GiftForm
            action={giveGiftAction.bind(null, gift.id)}
            custom={custom}
            quickAmounts={gift.quickAmountsCents ?? []}
            suggestedCents={gift.suggestedCents}
            minCents={gift.minCents}
            maxCents={gift.maxCents}
            coupleNames={settings.event.coupleNames}
            defaults={{
              name: first ? fullName(first.firstName, first.lastName) : '',
              email: guest?.invitation.email ?? first?.email ?? '',
              phone: guest?.invitation.phone ? formatPhone(guest.invitation.phone) : '',
            }}
          />
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
    </div>
  )
}
