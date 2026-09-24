'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Crest } from '@/components/ornaments/Ornaments'
import { Monogram } from './CoupleNames'

export type NavLink = { href: string; label: string }

type Props = {
  links: NavLink[]
  ctaHref: string
  ctaLabel: string
  ctaShort: string
  monogram: string
  portalHref?: string | null
}

export function SiteHeader({ links, ctaHref, ctaLabel, ctaShort, monogram, portalHref }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const allLinks = portalHref ? [{ href: portalHref, label: 'Meu convite' }, ...links] : links

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="monogram" aria-label="Início">
          <Monogram text={monogram} />
        </Link>
        <nav className="site-nav" aria-label="Principal">
          {allLinks.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="site-header__actions">
          <Link href={ctaHref} className="btn btn--primary btn--small header-cta" aria-label={ctaLabel}>
            <span className="header-cta__long">{ctaLabel}</span>
            <span className="header-cta__short" aria-hidden="true">
              {ctaShort}
            </span>
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="menu-sheet"
            onClick={() => setOpen(true)}
          >
            <span className="menu-toggle__lines" aria-hidden="true" />
            Menu
          </button>
        </div>
      </div>

      {open ? (
        <div id="menu-sheet" className="menu-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="menu-sheet__top">
            <span className="monogram">
              <Monogram text={monogram} />
            </span>
            <button type="button" className="menu-toggle" onClick={() => setOpen(false)}>
              Fechar <span aria-hidden="true">×</span>
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
          <Link href={ctaHref} className="btn btn--primary btn--block" onClick={() => setOpen(false)}>
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </header>
  )
}
