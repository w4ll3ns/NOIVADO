import { IntroGate } from '@/components/intro/IntroGate'
import { Hero } from '@/components/site/home/Hero'
import { DressCodeSection, EventDetails, LocationSection } from '@/components/site/home/EventSections'
import { FaqSection, GalleryTeaser, GiftsTeaser, GuestbookTeaser, StorySection } from '@/components/site/home/MoreSections'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { countApprovedPhotos, getCouplePhotos, getFaqs, getMainAlbum, getSchedule, getStory } from '@/lib/content'
import { formatDateDots } from '@/lib/format'
import { monogramFor } from '@/lib/event'

export default async function HomePage(props: PageProps<'/'>) {
  const sp = await props.searchParams
  const [settings, guest, schedule, story, faqs, photos, album] = await Promise.all([
    getSettings(),
    getCurrentGuest(),
    getSchedule(),
    getStory(),
    getFaqs(),
    getCouplePhotos(),
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
          monogram={monogramFor(e.coupleNames)}
          dateDots={formatDateDots(e.date)}
          phrase={settings.intro.phrase}
          buttonLabel={settings.intro.buttonLabel}
          welcomeTitle={guest ? `Olá, ${guest.greeting}!` : settings.intro.welcomePhrase}
          welcomeSub={guest ? settings.intro.welcomePhraseGuest : undefined}
          force={sp.abertura === '1'}
        />
      ) : null}
      <Hero settings={settings} greeting={guest?.greeting} rsvpHref={rsvpHref} />
      <StorySection settings={settings} milestones={story} photos={photos} />
      <EventDetails settings={settings} schedule={schedule} />
      <LocationSection settings={settings} />
      <DressCodeSection settings={settings} />
      <GiftsTeaser settings={settings} />
      <GalleryTeaser approved={approved} publicEnabled={!!album?.publicGalleryEnabled} />
      <FaqSection settings={settings} faqs={faqs} />
      <GuestbookTeaser settings={settings} />
    </>
  )
}
