import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { getCurrentGuest } from '@/lib/invitations'
import { getSettings } from '@/lib/settings'
import { formatDateLong } from '@/lib/format'

export const metadata: Metadata = { title: 'Confirmar presença' }

export default async function ConfirmPage() {
  const guest = await getCurrentGuest()
  if (guest) redirect(`/i/${guest.token}/presenca`)
  const settings = await getSettings()
  const phone = settings.event.contactPhone.replace(/\D/g, '')
  return (
    <div className="container narrow">
      <header className="page-head">
        <EngravedIcon name="envelope" size={56} className="teaser-icon" />
        <span className="eyebrow">Confirmação de presença</span>
        <h1 className="section-title">Seu convite é pessoal</h1>
        <Divider />
      </header>
      <div className="paper paper--ornate center" style={{ marginBottom: 'var(--section-y)' }}>
        <FrameCorners />
        <p className="section-lead" style={{ marginBottom: 18 }}>
          Preparamos um link especial para cada convite. Abra a mensagem que enviamos pelo WhatsApp e toque no link —
          lá você confirma a presença de cada pessoa do seu convite.
        </p>
        {settings.rsvp.deadline ? (
          <p className="muted">
            Confirme até <strong>{formatDateLong(settings.rsvp.deadline)}</strong>.
          </p>
        ) : null}
        <div className="btn-row" style={{ marginTop: 24 }}>
          {phone ? (
            <a className="btn btn--primary" href={`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent('Olá! Não encontrei o link do meu convite para o noivado.')}`} target="_blank" rel="noopener noreferrer">
              Não encontrei meu link
            </a>
          ) : null}
          <Link className="btn" href="/">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  )
}
