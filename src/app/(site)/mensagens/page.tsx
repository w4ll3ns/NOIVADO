import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { fullName } from '@/lib/format'
import { GuestbookForm } from './GuestbookForm'

export const metadata: Metadata = { title: 'Livro de mensagens' }

export default async function GuestbookPage() {
  const [settings, guest] = await Promise.all([getSettings(), getCurrentGuest()])
  if (!settings.guestbook.enabled) notFound()
  const first = guest?.guests.find((g) => !g.isCompanion)
  return (
    <div className="container narrow">
      <header className="page-head">
        <EngravedIcon name="envelope" size={56} className="teaser-icon" />
        <span className="eyebrow">Livro de mensagens</span>
        <h1 className="section-title">{settings.guestbook.title}</h1>
        <Divider />
        <p className="section-lead">{settings.guestbook.intro}</p>
      </header>
      <div className="paper paper--ornate" style={{ marginBottom: 'var(--section-y)' }}>
        <FrameCorners />
        <GuestbookForm defaultName={first ? fullName(first.firstName, first.lastName) : ''} coupleNames={settings.event.coupleNames} />
      </div>
    </div>
  )
}
