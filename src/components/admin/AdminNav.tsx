'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export type AdminNavItem = { href: string; label: string; icon: React.ReactNode; group?: string }

export function AdminNav({ items, footer }: { items: AdminNavItem[]; footer: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'))
  let lastGroup: string | undefined

  return (
    <>
      <div className="a-topbar">
        <Link href="/admin" className="a-brand__names" style={{ textDecoration: 'none', fontSize: '1.6rem' }}>
          Maby &amp; Chris
        </Link>
        <button type="button" className="a-btn" aria-expanded={open} onClick={() => setOpen(true)}>
          Menu
        </button>
      </div>
      <aside className={`a-sidebar${open ? ' is-open' : ''}`} aria-label="Menu do painel">
        <Link href="/admin" className="a-brand">
          <div className="a-brand__names">Maby &amp; Chris</div>
          <div className="a-brand__sub">Painel do noivado</div>
        </Link>
        {open ? (
          <button type="button" className="a-btn a-btn--sm" style={{ marginBottom: 8 }} onClick={() => setOpen(false)}>
            Fechar menu
          </button>
        ) : null}
        <nav className="a-nav">
          {items.map((item) => {
            const header = item.group && item.group !== lastGroup ? item.group : null
            lastGroup = item.group
            return (
              <div key={item.href} style={{ display: 'contents' }}>
                {header ? <div className="a-nav__group">{header}</div> : null}
                <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                  {item.icon}
                  {item.label}
                </Link>
              </div>
            )
          })}
        </nav>
        <div className="a-sidebar__foot">{footer}</div>
      </aside>
    </>
  )
}
