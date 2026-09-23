import type { Metadata } from 'next'
import Link from 'next/link'
import { Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { getSettings } from '@/lib/settings'
import { getAdmin } from '@/lib/auth/session'
import { findInvitationByToken, greetingFor, latestRsvp, listGuests } from '@/lib/invitations'
import { endOfDayInTz, formatDateLong, fullName } from '@/lib/format'
import { InvalidInvite } from '../InvalidInvite'
import { RsvpForm } from './RsvpForm'
import { submitRsvpAction } from './actions'

export const metadata: Metadata = { title: 'Confirmação de presença', robots: { index: false, follow: false } }

export default async function RsvpPage(props: PageProps<'/i/[token]/presenca'>) {
  const { token } = await props.params
  const sp = await props.searchParams
  const [settings, found] = await Promise.all([getSettings(), findInvitationByToken(token)])
  if (!found) return <InvalidInvite contactPhone={settings.event.contactPhone} />
  const inv = found.invitation
  const preview = sp.preview === '1' && !!(await getAdmin())
  const [guests, last] = await Promise.all([listGuests(inv.id), latestRsvp(inv.id)])
  const main = guests.filter((g) => !g.isCompanion)
  const companions = guests.filter((g) => g.isCompanion).map((g) => fullName(g.firstName, g.lastName))
  const plural = main.length > 1
  const deadline = settings.rsvp.deadline ? endOfDayInTz(settings.rsvp.deadline) : null
  const open = !deadline || deadline.getTime() > Date.now()
  const r = settings.rsvp

  return (
    <div className="container narrow">
      <header className="page-head">
        <span className="eyebrow">{inv.label}</span>
        <h1 className="section-title">{plural ? 'Contamos com vocês?' : 'Contamos com você?'}</h1>
        <Divider />
        <p className="muted">
          {greetingFor(inv, guests)}, {inv.rsvpStatus === 'pending' ? 'confirme a presença' : 'você pode alterar sua resposta'}
          {settings.rsvp.deadline ? ` até ${formatDateLong(settings.rsvp.deadline)}` : ''}.
        </p>
      </header>

      <div className="paper paper--ornate" style={{ marginBottom: 'var(--section-y)' }}>
        <FrameCorners />
        {open ? (
          <RsvpForm
            action={submitRsvpAction.bind(null, token)}
            token={token}
            preview={preview}
            giftsEnabled={settings.gifts.enabled}
            guests={main.map((g) => ({ id: g.id, name: fullName(g.firstName, g.lastName), attendance: g.attendance }))}
            companions={companions}
            maxCompanions={inv.allowCompanions ? inv.maxCompanions : 0}
            questions={{
              dietary: r.askDietary,
              specialNeeds: r.askSpecialNeeds,
              notes: r.askNotes,
              song: r.askSong,
              message: r.askMessage,
            }}
            previous={{
              dietary: last?.dietaryRestrictions ?? '',
              specialNeeds: last?.specialNeeds ?? '',
              notes: last?.notes ?? '',
              song: last?.songRequest ?? '',
            }}
            texts={{ intro: r.intro, confirmed: r.confirmedText, declined: r.declinedText }}
          />
        ) : (
          <div className="result">
            <p className="result__text">{r.closedText}</p>
            <div className="btn-row" style={{ marginTop: 24 }}>
              <Link href={`/i/${token}`} className="btn btn--primary">
                Voltar ao meu convite
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
