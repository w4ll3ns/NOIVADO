'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Crest } from '@/components/ornaments/Ornaments'
import { ehInicio, tokenDoCaminho } from '@/lib/convite-link'

export type NavLink = { href: string; label: string }

/** Onde a seção fica, descontando o cabeçalho fixo (o mesmo respiro do scroll-padding-top). */
function topoDe(alvo: HTMLElement) {
  const respiro = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)
  const margem = Number.isFinite(respiro) ? respiro : (document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0) + 12
  const maximo = document.documentElement.scrollHeight - window.innerHeight
  return Math.max(0, Math.min(maximo, alvo.getBoundingClientRect().top + window.scrollY - margem))
}

/**
 * Rolagem lenta até a seção, para o convidado ver o conteúdo passando: mais longe, um pouco mais de
 * tempo (até ~3,5s). Qualquer toque, roda ou tecla interrompe. Com "reduzir movimento", vai direto.
 */
function rolarDevagar(alvo: HTMLElement, doTopo = false) {
  const html = document.documentElement
  const antes = html.style.scrollBehavior
  // O CSS rola "smooth": aqui cada quadro tem que ir direto ao ponto.
  html.style.scrollBehavior = 'auto'
  if (doTopo) window.scrollTo(0, 0)
  const inicio = window.scrollY
  const distancia = Math.abs(topoDe(alvo) - inicio)
  if (distancia < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, topoDe(alvo))
    html.style.scrollBehavior = antes
    return
  }
  const duracao = Math.min(3500, 900 + distancia * 0.8)
  const eventos = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
  let ativo = true
  const parar = () => {
    if (!ativo) return
    ativo = false
    html.style.scrollBehavior = antes
    for (const ev of eventos) window.removeEventListener(ev, parar)
  }
  for (const ev of eventos) window.addEventListener(ev, parar, { passive: true })
  const t0 = performance.now()
  const quadro = (agora: number) => {
    if (!ativo) return
    const t = Math.min(1, (agora - t0) / duracao)
    // Destino recalculado a cada quadro: fotos que carregam no caminho não fazem errar a seção.
    window.scrollTo(0, inicio + (topoDe(alvo) - inicio) * (0.5 - Math.cos(Math.PI * t) / 2))
    if (t < 1) requestAnimationFrame(quadro)
    else parar()
  }
  requestAnimationFrame(quadro)
}

/**
 * Âncora da home ("/#localizacao"). Na home (ou no link do convite, que é a home) rola até a seção sem
 * sair da página, mesmo que o endereço já tenha essa âncora. Em outra página, o link navega normalmente.
 */
function rolarAte(e: MouseEvent<HTMLAnchorElement>, href: string, devagar = false) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  const [path, id] = href.split('#')
  if (!id || path !== '/' || !ehInicio(window.location.pathname)) return
  const alvo = document.getElementById(id)
  if (!alvo) return
  e.preventDefault()
  // Depois do clique (o menu pode estar fechando e devolvendo a rolagem da página).
  requestAnimationFrame(() => (devagar ? rolarDevagar(alvo) : alvo.scrollIntoView({ behavior: 'smooth', block: 'start' })))
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
}

export function SiteHeader({ links, ctaHref, rsvpHref, ctaLabel, ctaShort }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const descerAte = useRef<string | null>(null)
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

  // Botão de presença vindo de outra página: abre a home e desce devagar até a seção.
  useEffect(() => {
    const id = descerAte.current
    if (!id || !ehInicio(pathname)) return
    descerAte.current = null
    let tentativas = 0
    let raf = requestAnimationFrame(function procurar() {
      const alvo = document.getElementById(id)
      if (alvo) rolarDevagar(alvo, true)
      else if (++tentativas < 120) raf = requestAnimationFrame(procurar)
    })
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  const irParaPresenca = (e: MouseEvent<HTMLAnchorElement>) => {
    if (ehInicio(pathname)) return rolarAte(e, ctaHref, true)
    const [path, id] = ctaHref.split('#')
    if (!id || path !== '/' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    descerAte.current = id
    // No link do convite, a home é o próprio convite.
    const token = tokenDoCaminho(pathname)
    router.push(token ? `/i/${token}` : '/', { scroll: false })
  }

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
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined} onClick={(e) => rolarAte(e, l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href={ctaHref}
          className="btn btn--primary btn--small header-cta"
          aria-label={ctaLabel}
          onClick={irParaPresenca}
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
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={(e) => {
                          rolarAte(e, l.href)
                          setOpen(false)
                        }}
                      >
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
