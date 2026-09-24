import Link from 'next/link'
import { SectionHead } from '@/components/site/SectionHead'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import type { Settings } from '@/lib/settings-schema'
import { eventTemplateValues, renderTemplate } from '@/lib/templates'

export function GiftsTeaser({ settings }: { settings: Settings }) {
  if (!settings.gifts.enabled) return null
  const first = settings.gifts.intro.split(/\n\s*\n/)
  return (
    <section id="presentes" className="section">
      <div className="container narrow center">
        <SectionHead eyebrow="Com carinho" title="Lista de Presentes" />
        <EngravedIcon name="presente" size={56} className="teaser-icon" />
        {first.map((p, i) => (
          <p key={i} className="section-lead" style={{ marginBottom: 14 }}>
            {p}
          </p>
        ))}
        <div className="btn-row" style={{ marginTop: 26 }}>
          <Link href="/presentes" className="btn btn--primary">
            Ver presentes
          </Link>
        </div>
      </div>
    </section>
  )
}

export function GalleryTeaser({ approved, publicEnabled }: { approved: number; publicEnabled: boolean }) {
  if (!publicEnabled || approved === 0) return null
  return (
    <section className="section section--cream">
      <div className="container narrow center">
        <SectionHead eyebrow="Álbum colaborativo" title="Nosso noivado pelos seus olhos." />
        <EngravedIcon name="camera" size={56} className="teaser-icon" />
        <p className="section-lead">
          {approved === 1 ? 'Uma fotografia' : `${approved} fotografias`} registradas por quem esteve com a gente.
        </p>
        <div className="btn-row" style={{ marginTop: 26 }}>
          <Link href="/galeria#album" className="btn">
            Ver o álbum
          </Link>
        </div>
      </div>
    </section>
  )
}

export function FaqSection({ settings, faqs }: { settings: Settings; faqs: { id: string; question: string; answer: string }[] }) {
  if (!faqs.length) return null
  const values = eventTemplateValues(settings)
  return (
    <section id="duvidas" className="section">
      <div className="container">
        <SectionHead eyebrow="Perguntas frequentes" title="Dúvidas" />
        <div className="faq">
          {faqs.map((f) => (
            <details key={f.id}>
              <summary>{f.question}</summary>
              <div className="faq__answer">{renderTemplate(f.answer, values)}</div>
            </details>
          ))}
        </div>
        {settings.event.contactPhone ? (
          <p className="center muted" style={{ marginTop: 28 }}>
            Ficou alguma dúvida?{' '}
            <a href={`https://api.whatsapp.com/send?phone=${settings.event.contactPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
              Fale com {settings.event.contactName}
            </a>
            .
          </p>
        ) : null}
      </div>
    </section>
  )
}

export function GuestbookTeaser({ settings }: { settings: Settings }) {
  if (!settings.guestbook.enabled) return null
  return (
    <section className="section section--cream">
      <div className="container narrow center">
        <EngravedIcon name="envelope" size={56} className="teaser-icon" />
        <h2 className="section-title" style={{ marginTop: 10 }}>
          {settings.guestbook.title}
        </h2>
        <p className="section-lead" style={{ marginTop: 14 }}>
          {settings.guestbook.intro}
        </p>
        <div className="btn-row" style={{ marginTop: 26 }}>
          <Link href="/mensagens" className="btn">
            Escrever uma mensagem
          </Link>
        </div>
      </div>
    </section>
  )
}
