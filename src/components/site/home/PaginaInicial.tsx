import { IntroGate } from '@/components/intro/IntroGate'
import { ViewBeacon } from '@/components/guest/Beacons'
import { Hero } from './Hero'
import { EventDetails, GuideSection } from './EventSections'
import { FaqSection, GalleryTeaser, GuestbookTeaser } from './MoreSections'
import { getSettings } from '@/lib/settings'
import { countApprovedPhotos, getFaqs, getMainAlbum, getSchedule } from '@/lib/content'
import { formatDateDots } from '@/lib/format'
import type { CurrentGuest } from '@/lib/invitations'

type Props = {
  guest: CurrentGuest | null
  /** Abertura com o casarão (fica de fora na pré-visualização do painel). */
  abertura?: boolean
  /** "?abertura=1": mostra a abertura de novo, mesmo já vista. */
  forcarAbertura?: boolean
  /** Pré-visualização do painel: não registra visualizações. */
  preview?: boolean
}

/** A home do site: a mesma para quem entra pelo endereço e para quem abre o link do convite. */
export async function PaginaInicial({ guest, abertura = true, forcarAbertura, preview }: Props) {
  const [settings, schedule, faqs, album] = await Promise.all([getSettings(), getSchedule(), getFaqs(), getMainAlbum()])
  const approved = album ? await countApprovedPhotos(album.id) : 0
  const e = settings.event
  const rsvpHref = guest ? `/i/${guest.token}/presenca${preview ? '?preview=1' : ''}` : '/confirmar'

  return (
    <>
      {settings.intro.enabled && abertura ? (
        <IntroGate
          coupleNames={e.coupleNames}
          eventTitle={e.title}
          namesSize={settings.intro.namesSizeIntro}
          venueName={e.venueName}
          dateDots={formatDateDots(e.date)}
          phrase={settings.intro.phrase}
          buttonLabel={settings.intro.buttonLabel}
          welcomeTitle={guest ? `Olá, ${guest.greeting}!` : settings.intro.welcomePhrase}
          welcomeSub={guest ? settings.intro.welcomePhraseGuest : undefined}
          force={forcarAbertura}
        />
      ) : null}
      <Hero settings={settings} greeting={guest?.greeting} />
      <EventDetails settings={settings} schedule={schedule} />
      {guest ? <ViewBeacon type="event_info_viewed" disabled={preview} /> : null}
      <GuideSection settings={settings} rsvpHref={rsvpHref} responded={!!guest && guest.invitation.rsvpStatus !== 'pending'} />
      <GalleryTeaser approved={approved} publicEnabled={!!album?.publicGalleryEnabled} />
      <FaqSection settings={settings} faqs={faqs} first={schedule[0]} />
      <GuestbookTeaser settings={settings} />
    </>
  )
}
