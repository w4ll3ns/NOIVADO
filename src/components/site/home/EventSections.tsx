import Link from 'next/link'
import type { CSSProperties } from 'react'
import { CompassRose, Rule } from '@/components/ornaments/Ornaments'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { SectionHead } from '@/components/site/SectionHead'
import type { Settings } from '@/lib/settings-schema'
import { endOfDayInTz, formatDateLong, weekdayOf } from '@/lib/format'
import { eventTime, googleMapsUrl, wazeUrl } from '@/lib/event'
import { mediaUrl } from '@/lib/media'

type ScheduleItem = { id: string; timeLabel: string; title: string; description: string | null; iconMediaId: string | null }

export function EventDetails({ settings, schedule }: { settings: Settings; schedule: ScheduleItem[] }) {
  const e = settings.event
  const guidance = [
    { title: 'Estacionamento', text: e.parking },
    { title: 'Manobrista', text: e.valet },
    { title: 'Entrada', text: e.entrance },
    { title: 'Observações', text: e.notes },
    { title: 'Recomendações', text: e.recommendations },
  ].filter((g) => g.text.trim())
  const withIcons = schedule.some((s) => s.iconMediaId)
  const horario = eventTime(e, schedule[0])
  return (
    <section id="noivado" className="section section--cream">
      <div className="container">
        <SectionHead title={`O nosso ${e.title.toLowerCase()}`} />
        <div className="details-grid">
          <div className="detail">
            <EngravedIcon name="aliancas" />
            <div className="detail__label">Data</div>
            <div className="detail__value">{formatDateLong(e.date)}</div>
            <div className="detail__hint">{weekdayOf(e.date)}</div>
          </div>
          <div className="detail">
            <EngravedIcon name="relogio" />
            <div className="detail__label">Horário</div>
            <div className="detail__value">{horario.time}</div>
            <div className="detail__hint">{horario.label}</div>
          </div>
          <div className="detail">
            <EngravedIcon name="casa" />
            <div className="detail__label">Local</div>
            <div className="detail__value">{e.venueName}</div>
            <div className="detail__hint">{e.region}</div>
          </div>
        </div>

        {schedule.length ? (
          <div className="programme-block">
            <h3 className="programme__heading">Programação</h3>
            <Rule />
            {/* Linha do tempo: ícone | losango na linha | horário e momento */}
            <ol className={withIcons ? 'programme' : 'programme programme--sem-icones'} aria-label="Programação">
              {schedule.map((s) => (
                <li key={s.id} className="programme__item">
                  <span className="programme__icon" aria-hidden="true">
                    {s.iconMediaId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(s.iconMediaId, 'thumb')!} alt="" width={96} height={96} loading="lazy" decoding="async" />
                    ) : null}
                  </span>
                  <span className="programme__marker" aria-hidden="true" />
                  <span className="programme__text">
                    <span className="programme__time">{s.timeLabel}</span>
                    <span className="programme__title">{s.title}</span>
                    {s.description ? <span className="programme__desc">{s.description}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {guidance.length ? (
          <div className="guidance">
            {guidance.map((g) => (
              <div key={g.title} className="guidance__item">
                <h3>{g.title}</h3>
                <p>{g.text}</p>
              </div>
            ))}
          </div>
        ) : null}

      </div>
    </section>
  )
}

/** Localização, Dress Code, Lista de Presentes e Confirmar presença, reunidos numa seção só. */
export function GuideSection({ settings, rsvpHref, responded }: { settings: Settings; rsvpHref: string; responded: boolean }) {
  const e = settings.event
  const r = settings.rsvp
  const deadline = r.deadline ? endOfDayInTz(r.deadline) : null
  const rsvpOpen = !deadline || deadline.getTime() > Date.now()
  const atalhos: Atalho[] = [
    { href: googleMapsUrl(e), external: true, icon: 'mapa', title: 'Google Maps', sub: 'Como chegar' },
    { href: wazeUrl(e), external: true, icon: 'pin', title: 'Waze', sub: 'Como chegar' },
    ...(settings.dressCode.enabled
      ? [{ href: '/traje', icon: 'vestido', title: 'Dress Code', sub: settings.dressCode.type }]
      : []),
    ...(settings.gifts.enabled
      ? [{ href: '/presentes', icon: 'presente', title: 'Lista de Presentes', sub: 'Com carinho' }]
      : []),
  ]
  return (
    <section id="localizacao" className="section">
      <div className="container">
        <SectionHead eyebrow="Para o grande dia" title="Informações" />
        <div className="guia">
          <CompassRose title="Rosa dos ventos" />
          <p className="guia__venue">{e.venueName}</p>
          <p className="guia__address">{e.address}</p>
          <ul className="atalhos" style={{ '--n': atalhos.length } as CSSProperties}>
            {atalhos.map((a) => {
              const body = (
                <>
                  <EngravedIcon name={a.icon} />
                  <span className="atalho__titulo">{a.title}</span>
                  <span className="atalho__sub">{a.sub}</span>
                </>
              )
              return (
                <li key={a.title}>
                  {a.external ? (
                    <a className="atalho" href={a.href} target="_blank" rel="noopener noreferrer">
                      {body}
                    </a>
                  ) : (
                    <Link className="atalho" href={a.href}>
                      {body}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
          <Link href={rsvpHref} className="btn btn--primary guia__rsvp">
            {responded ? 'Minha presença' : 'Confirmar presença'}
          </Link>
          {r.deadline && rsvpOpen ? (
            <p className="guia__prazo">
              {responded ? 'Você pode alterar' : 'Confirme'} até {formatDateLong(r.deadline)}.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

type Atalho = { href: string; external?: boolean; icon: string; title: string; sub: string }
