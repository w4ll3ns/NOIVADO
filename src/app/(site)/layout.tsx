import { headers } from 'next/headers'
import { SiteHeader, type NavLink } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { MusicPlayer } from '@/components/music/MusicPlayer'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest, getGuestByToken } from '@/lib/invitations'
import { CONVITE_HEADER } from '@/lib/convite-link'
import { formatDateDots } from '@/lib/format'
import { mediaUrl } from '@/lib/media'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // No link do convite vale o convidado do endereço; no resto do site, o do cookie.
  const doLink = (await headers()).get(CONVITE_HEADER)
  const [settings, guest] = await Promise.all([
    getSettings(),
    doLink ? getGuestByToken(doLink).then((g) => g ?? getCurrentGuest()) : getCurrentGuest(),
  ])
  const links: NavLink[] = [
    { href: '/#inicio', label: 'Início' },
    { href: '/#noivado', label: 'O Noivado' },
    { href: '/#localizacao', label: 'Localização' },
    ...(settings.dressCode.enabled ? [{ href: '/traje', label: 'Dress Code' }] : []),
    ...(settings.gifts.enabled ? [{ href: '/presentes', label: 'Presentes' }] : []),
    { href: '/galeria', label: 'Galeria' },
    { href: '/#duvidas', label: 'Dúvidas' },
  ]
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <SiteHeader
        links={links}
        ctaHref="/#localizacao"
        rsvpHref={guest ? `/i/${guest.token}/presenca` : '/confirmar'}
        ctaLabel={guest && guest.invitation.rsvpStatus !== 'pending' ? 'Minha presença' : 'Confirmar presença'}
        ctaShort={guest && guest.invitation.rsvpStatus !== 'pending' ? 'Presença' : 'Confirmar'}
      />
      <main id="conteudo" tabIndex={-1} className="page-main">
        {children}
      </main>
      <SiteFooter
        coupleNames={settings.event.coupleNames}
        dateDots={formatDateDots(settings.event.date)}
        showGuestbook={settings.guestbook.enabled}
      />
      {settings.intro.musicMediaId ? (
        <MusicPlayer src={mediaUrl(settings.intro.musicMediaId, 'audio')!} volume={settings.intro.musicVolume} />
      ) : null}
    </>
  )
}
