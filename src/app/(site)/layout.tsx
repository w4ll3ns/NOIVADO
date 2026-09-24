import { SiteHeader, type NavLink } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { formatDateDots } from '@/lib/format'
import { monogramFor } from '@/lib/event'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, guest] = await Promise.all([getSettings(), getCurrentGuest()])
  const links: NavLink[] = [
    { href: '/#inicio', label: 'Início' },
    { href: '/#noivado', label: 'O Noivado' },
    { href: '/#localizacao', label: 'Localização' },
    ...(settings.dressCode.enabled ? [{ href: '/#traje', label: 'Dress Code' }] : []),
    ...(settings.gifts.enabled ? [{ href: '/presentes', label: 'Presentes' }] : []),
    { href: '/galeria', label: 'Galeria' },
    { href: '/#duvidas', label: 'Dúvidas' },
  ]
  const monogram = monogramFor(settings.event.coupleNames)
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <SiteHeader
        links={links}
        monogram={monogram}
        ctaHref={guest ? `/i/${guest.token}/presenca` : '/confirmar'}
        ctaLabel={guest && guest.invitation.rsvpStatus !== 'pending' ? 'Minha presença' : 'Confirmar presença'}
        ctaShort={guest && guest.invitation.rsvpStatus !== 'pending' ? 'Presença' : 'Confirmar'}
        portalHref={guest ? `/i/${guest.token}` : null}
      />
      <main id="conteudo" tabIndex={-1} className="page-main">
        {children}
      </main>
      <SiteFooter
        coupleNames={settings.event.coupleNames}
        dateDots={formatDateDots(settings.event.date)}
        showGuestbook={settings.guestbook.enabled}
      />
    </>
  )
}
