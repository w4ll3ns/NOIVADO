import { IntroGate } from '@/components/intro/IntroGate'
import { Hero } from '@/components/site/home/Hero'
import { EventDetails, GuideSection } from '@/components/site/home/EventSections'
import { FaqSection, GalleryTeaser, GuestbookTeaser } from '@/components/site/home/MoreSections'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { countApprovedPhotos, getFaqs, getMainAlbum, getSchedule } from '@/lib/content'
import { formatDateDots } from '@/lib/format'

export default async function HomePage(props: PageProps<'/'>) {
  const sp = await props.searchParams
  const [settings, guest, schedule, faqs, album] = await Promise.all([
    getSettings(),
    getCurrentGuest(),
    getSchedule(),
    getFaqs(),
    getMainAlbum(),
  ])
  const approved = album ? await countApprovedPhotos(album.id) : 0
  const e = settings.event
  const rsvpHref = guest ? `/i/${guest.token}/presenca` : '/confirmar'

  return (
    <>
      {settings.intro.enabled ? (
        <IntroGate
          coupleNames={e.coupleNames}
          venueName={e.venueName}
          dateDots={formatDateDots(e.date)}
          phrase={settings.intro.phrase}
          buttonLabel={settings.intro.buttonLabel}
          welcomeTitle={guest ? `Olá, ${guest.greeting}!` : settings.intro.welcomePhrase}
          welcomeSub={guest ? settings.intro.welcomePhraseGuest : undefined}
          force={sp.abertura === '1'}
        />
      ) : null}
      <Hero settings={settings} greeting={guest?.greeting} />
      <EventDetails settings={settings} schedule={schedule} />
      <GuideSection settings={settings} rsvpHref={rsvpHref} responded={!!guest && guest.invitation.rsvpStatus !== 'pending'} />
      <GalleryTeaser approved={approved} publicEnabled={!!album?.publicGalleryEnabled} />
      <FaqSection settings={settings} faqs={faqs} first={schedule[0]} />
      <GuestbookTeaser settings={settings} />
    </>
  )
}
