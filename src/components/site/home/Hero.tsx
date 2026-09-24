import Link from 'next/link'
import { Casarao } from '@/components/casarao/Casarao'
import { Divider, Rule, SaveTheDateFrame } from '@/components/ornaments/Ornaments'
import { CoupleNames } from '@/components/site/CoupleNames'
import type { Settings } from '@/lib/settings-schema'
import { daysUntil, formatDateLong } from '@/lib/format'

export function Countdown({ settings }: { settings: Settings }) {
  const days = daysUntil(settings.event.date)
  if (days < 0) return <p className="countdown">{settings.home.countdownPastText}</p>
  if (days === 0) return <p className="countdown">{settings.home.countdownTodayText}</p>
  const text = days === 1 ? settings.home.countdownText.replace(/Faltam/i, 'Falta').replace('dias', 'dia') : settings.home.countdownText
  const [before, after] = text.split('{{dias}}')
  return (
    <p className="countdown">
      {before}
      <strong>{days}</strong>
      {after ?? ''}
    </p>
  )
}

export function Hero({ settings, greeting, rsvpHref }: { settings: Settings; greeting?: string | null; rsvpHref: string }) {
  const e = settings.event
  return (
    <section id="inicio" className="hero">
      <div className="container hero__content">
        {greeting ? <p className="greeting script">Olá, {greeting}!</p> : null}
        {/* O Save the Date, vivo: a moldura original com os textos do site dentro. */}
        <div className="convite">
          <SaveTheDateFrame className="convite__moldura" />
          <div className="convite__miolo">
            <h1 className="convite__titulo">
              <span className="convite__evento">{e.title}</span>
              <Divider className="convite__filete" />
              <span className="convite__nomes script">
                <CoupleNames names={e.coupleNames} />
              </span>
            </h1>
            <Casarao forte priority alt={`Fachada da ${e.venueName}`} sizes="(max-width: 640px) 30vw, 180px" className="convite__casarao" />
            <Divider className="convite__filete" />
            <p className="convite__data">{formatDateLong(e.date)}</p>
            <Rule className="convite__filete convite__filete--curto" />
            <p className="convite__local">
              {e.venueName}
              {e.region ? ` - ${e.region}` : ''}
            </p>
          </div>
        </div>
        <Countdown settings={settings} />
        <div className="btn-row btn-row--inline">
          <Link href={rsvpHref} className="btn btn--primary">
            Confirmar presença
          </Link>
          <Link href="/#noivado" className="btn">
            Ver detalhes
          </Link>
        </div>
        {settings.gifts.enabled && settings.home.showGiftsButton ? (
          <p style={{ marginTop: 14 }}>
            <Link href="/presentes" className="btn btn--link">
              Ver presentes
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  )
}
