import Link from 'next/link'
import { Facade } from '@/components/casarao/Facade'
import { Crest, Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { CoupleNames } from '@/components/site/CoupleNames'
import type { Settings } from '@/lib/settings-schema'
import { daysUntil, formatDateLong } from '@/lib/format'
import { monogramFor } from '@/lib/event'

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
      <div className="hero__frame" aria-hidden="true">
        <FrameCorners />
      </div>
      <div className="container hero__content">
        <Crest />
        {greeting ? <p className="greeting script">Olá, {greeting}!</p> : null}
        <h1>
          <span className="hero__title">{e.title}</span>
          <span className="hero__names script" style={{ display: 'block' }}>
            <CoupleNames names={e.coupleNames} />
          </span>
        </h1>
        <div className="hero__facade">
          <Facade idPrefix="hero" className="cz--small" monogram={monogramFor(e.coupleNames)} title={`Fachada da ${e.venueName}`} />
        </div>
        <Divider />
        <p className="hero__date">{formatDateLong(e.date)}</p>
        <Divider />
        <p className="hero__venue">
          <strong>{e.venueName}</strong>
          {e.region}
        </p>
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
