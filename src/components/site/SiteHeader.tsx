'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Crest } from '@/components/ornaments/Ornaments'

export type NavLink = { href: string; label: string }

/**
 * Já na página da âncora (ex.: "/#localizacao" estando na home): rola suavemente até a seção,
 * mesmo que o endereço já tenha essa âncora. Em outra página, o link navega normalmente.
 */
function rolarAte(e: MouseEvent<HTMLAnchorElement>, href: string) {
  const [path, id] = href.split('#')
  if (!id || window.location.pathname !== (path || '/')) return
  const alvo = document.getElementById(id)
  if (!alvo) return
  e.preventDefault()
  alvo.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (window.location.hash !== `#${id}`) history.replaceState(history.state, '', `#${id}`)
}

type Props = {
  links: NavLink[]
  /** Botão fixo do cabeçalho: leva à seção Informações (onde está o "Confirmar presença"). */
  ctaHref: string
  /** Botão do menu aberto: vai direto para a confirmação. */
  rsvpHref: string
  ctaLabel: string
  ctaShort: string
  portalHref?: string | null
}

export function SiteHeader({ links, ctaHref, rsvpHref, ctaLabel, ctaShort, portalHref }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const toggle = toggleRef.current
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false)
      if (e.key !== 'Tab') return
      // Mantém o Tab dentro do menu aberto.
      const items = [...(sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button') ?? [])]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      // Ao fechar, o foco volta para o botão "Menu" (se ele ainda estiver visível).
      if (toggle?.offsetParent) toggle.focus({ preventScroll: true })
    }
  }, [open])

  const allLinks = portalHref ? [{ href: portalHref, label: 'Meu convite' }, ...links] : links

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <button
          ref={toggleRef}
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="menu-sheet"
          onClick={() => setOpen(true)}
        >
          <span className="menu-toggle__lines" aria-hidden="true" />
          Menu
        </button>
        <nav className="site-nav" aria-label="Principal">
          {allLinks.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href={ctaHref}
          className="btn btn--primary btn--small header-cta"
          aria-label={ctaLabel}
          onClick={(e) => rolarAte(e, ctaHref)}
        >
          <span className="header-cta__long">{ctaLabel}</span>
          <span className="header-cta__short" aria-hidden="true">
            {ctaShort}
          </span>
        </Link>
      </div>

      {/* No <body>: dentro do cabeçalho (que tem backdrop-filter) a folha ficaria presa na altura dele. */}
      {open
        ? createPortal(
            <div ref={sheetRef} id="menu-sheet" className="menu-sheet" role="dialog" aria-modal="true" aria-label="Menu">
              <div className="menu-sheet__top">
                <button ref={closeRef} type="button" className="menu-toggle" onClick={() => setOpen(false)}>
                  <span className="menu-toggle__x" aria-hidden="true">
                    ×
                  </span>
                  Fechar
                </button>
              </div>
              <nav aria-label="Menu">
                <Crest />
                <ul>
                  {allLinks.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} onClick={() => setOpen(false)}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <Link href={rsvpHref} className="btn btn--primary btn--block" onClick={() => setOpen(false)}>
                {ctaLabel}
              </Link>
            </div>,
            document.body,
          )
        : null}
    </header>
  )
}
