import Image from 'next/image'
import { CompassRose, FrameCorners } from '@/components/ornaments/Ornaments'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { SectionHead } from '@/components/site/SectionHead'
import type { Settings } from '@/lib/settings-schema'
import { formatDateDots, formatDateLong, formatTime, weekdayOf } from '@/lib/format'
import { googleMapsUrl, wazeUrl } from '@/lib/event'
import { mediaUrl } from '@/lib/media'

type ScheduleItem = { id: string; timeLabel: string; title: string; description: string | null }

export function EventDetails({ settings, schedule, showCard = true }: { settings: Settings; schedule: ScheduleItem[]; showCard?: boolean }) {
  const e = settings.event
  const guidance = [
    { title: 'Estacionamento', text: e.parking },
    { title: 'Manobrista', text: e.valet },
    { title: 'Entrada', text: e.entrance },
    { title: 'Observações', text: e.notes },
    { title: 'Recomendações', text: e.recommendations },
  ].filter((g) => g.text.trim())
  return (
    <section id="noivado" className="section section--cream">
      <div className="container">
        <SectionHead eyebrow={formatDateDots(e.date)} title={`O nosso ${e.title.toLowerCase()}`} />
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
            <div className="detail__value">{formatTime(e.receptionTime || e.mainTime)}</div>
            <div className="detail__hint">
              {e.receptionTime ? 'Recepção dos convidados' : 'Início da celebração'}
            </div>
          </div>
          <div className="detail">
            <EngravedIcon name="casa" />
            <div className="detail__label">Local</div>
            <div className="detail__value">{e.venueName}</div>
            <div className="detail__hint">{e.region}</div>
          </div>
        </div>

        {schedule.length ? (
          <ol className="programme" aria-label="Programação">
            {schedule.map((s) => (
              <li key={s.id} className="programme__item">
                <span className="programme__time">{s.timeLabel}</span>
                <span>
                  <span className="programme__title">{s.title}</span>
                  {s.description ? <span className="programme__desc" style={{ display: 'block' }}>{s.description}</span> : null}
                </span>
              </li>
            ))}
          </ol>
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

        {showCard ? (
          <figure className="std-card">
            <div className="std-card__frame">
              <FrameCorners />
              <Image
                src="/brand/save-the-date.jpg"
                alt={`Save the Date — ${e.title} de ${e.coupleNames}, ${formatDateLong(e.date)}, ${e.venueName}`}
                width={882}
                height={1280}
                sizes="(min-width: 760px) 360px, 78vw"
              />
            </div>
            <figcaption>O nosso Save the Date</figcaption>
          </figure>
        ) : null}
      </div>
    </section>
  )
}

export function LocationSection({ settings }: { settings: Settings }) {
  const e = settings.event
  return (
    <section id="localizacao" className="section">
      <div className="container">
        <SectionHead eyebrow="Como chegar" title="Localização" />
        <div className="location">
          <CompassRose title="Rosa dos ventos" />
          <div className="location__text">
            <p className="location__venue">{e.venueName}</p>
            <p className="location__address">{e.address}</p>
            <div className="btn-row" style={{ marginInline: 0 }}>
              <a className="btn btn--primary" href={googleMapsUrl(e)} target="_blank" rel="noopener noreferrer">
                Abrir no Google Maps
              </a>
              <a className="btn" href={wazeUrl(e)} target="_blank" rel="noopener noreferrer">
                Abrir no Waze
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function DressCodeSection({ settings }: { settings: Settings }) {
  const d = settings.dressCode
  if (!d.enabled) return null
  return (
    <section id="traje" className="section section--cream">
      <div className="container">
        <SectionHead eyebrow="Traje" title="Dress Code" />
        <div className="dress">
          <EngravedIcon name="vestido" className="dress__icon" />
          <p className="dress__type">{d.type}</p>
          <p className="dress__desc">“{d.description}”</p>
          {d.suggestedColors.length ? (
            <>
              <p className="dress__group-title">Paleta sugerida</p>
              <ul className="swatches">
                {d.suggestedColors.map((c) => (
                  <li key={c.name + c.hex} className="swatch">
                    <span className="swatch__chip" style={{ backgroundColor: c.hex }} />
                    {c.name}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {d.reservedColors.length ? (
            <>
              <p className="dress__group-title">Cores reservadas</p>
              <ul className="swatches">
                {d.reservedColors.map((c) => (
                  <li key={c.name + c.hex} className="swatch swatch--reserved">
                    <span className="swatch__chip" style={{ backgroundColor: c.hex }} />
                    {c.name}
                  </li>
                ))}
              </ul>
              {d.reservedNote ? <p className="muted italic" style={{ marginTop: 14 }}>{d.reservedNote}</p> : null}
            </>
          ) : null}
          {d.recommendations ? <p style={{ marginTop: 26 }}>{d.recommendations}</p> : null}
          {d.referenceMediaIds.length ? (
            <div className="dress__refs">
              {d.referenceMediaIds.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={mediaUrl(id, 'thumb')!} alt="Referência de traje" loading="lazy" decoding="async" />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
