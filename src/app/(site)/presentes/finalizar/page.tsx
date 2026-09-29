import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Divider } from '@/components/ornaments/Ornaments'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { listPublicGifts } from '@/lib/gifts'
import { formatPhone, fullName } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import { Finalizar, type PresenteInfo } from './Finalizar'
import { finalizarPresentesAction } from './actions'

export const metadata: Metadata = { title: 'Seus presentes', robots: { index: false, follow: false } }

export default async function FinalizarPage() {
  const [settings, guest, groups] = await Promise.all([getSettings(), getCurrentGuest(), listPublicGifts()])
  if (!settings.gifts.enabled) notFound()
  const presentes: PresenteInfo[] = groups.flatMap(({ gifts }) =>
    gifts.map((g) => ({
      id: g.id,
      nome: g.name,
      imagem: mediaUrl(g.mediaId, 'thumb'),
      icone: g.icon,
      livre: g.priceType === 'custom',
      cents: g.amountCents,
      minCents: g.minCents,
      maxCents: g.maxCents,
      sugestoes: g.quickAmountsCents ?? [],
      disponivel: g.avail.available,
    })),
  )
  const first = guest?.guests.find((g) => !g.isCompanion)
  return (
    <div className="container narrow" style={{ paddingBottom: 'var(--section-y)' }}>
      <p style={{ paddingTop: 24 }}>
        <Link href="/presentes" className="btn btn--link">
          ‹ Voltar à lista
        </Link>
      </p>
      <header className="page-head" style={{ paddingTop: 12 }}>
        <span className="eyebrow">Com carinho</span>
        <h1 className="section-title">Seus presentes</h1>
        <Divider />
      </header>
      <Finalizar
        presentes={presentes}
        action={finalizarPresentesAction}
        coupleNames={settings.event.coupleNames}
        defaults={{
          name: first ? fullName(first.firstName, first.lastName) : '',
          email: guest?.invitation.email ?? first?.email ?? '',
          phone: guest?.invitation.phone ? formatPhone(guest.invitation.phone) : '',
        }}
      />
    </div>
  )
}
