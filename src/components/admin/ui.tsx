import Link from 'next/link'
import type { PaymentStatus, PhotoStatus, RsvpStatus } from '@/lib/db/schema'
import { PAYMENT_LABEL, PHOTO_LABEL, RSVP_LABEL } from '@/lib/admin/labels'
import { formatDateTimeCompact } from '@/lib/format'

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="a-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="a-actions">{actions}</div> : null}
    </header>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'bad' | 'neutral' | 'accent'; children: React.ReactNode }) {
  const cls = tone === 'neutral' ? 'a-badge' : `a-badge a-badge--${tone}`
  return <span className={cls}>{children}</span>
}

export function SentBadge({ sentAt }: { sentAt: Date | null }) {
  return sentAt ? <Badge tone="accent">✓ Enviado</Badge> : <Badge>○ Não enviado</Badge>
}

export function AccessBadge({ firstAccessedAt, lastAccessedAt, count }: { firstAccessedAt: Date | null; lastAccessedAt?: Date | null; count?: number }) {
  if (!firstAccessedAt) return <Badge>○ Não acessado</Badge>
  return (
    <span title={`Primeiro acesso: ${formatDateTimeCompact(firstAccessedAt)}${lastAccessedAt ? ` · Último: ${formatDateTimeCompact(lastAccessedAt)}` : ''}`}>
      <Badge tone="accent">◉ Link acessado{count && count > 1 ? ` · ${count}×` : ''}</Badge>
    </span>
  )
}

export function RsvpBadge({ status }: { status: RsvpStatus }) {
  const tone = status === 'attending' ? 'ok' : status === 'declined' ? 'bad' : 'warn'
  const icon = status === 'attending' ? '✓' : status === 'declined' ? '✕' : '…'
  return (
    <Badge tone={tone}>
      {icon} {RSVP_LABEL[status]}
    </Badge>
  )
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone = status === 'approved' ? 'ok' : status === 'awaiting' ? 'warn' : status === 'refunded' ? 'neutral' : 'bad'
  const icon = status === 'approved' ? '✓' : status === 'awaiting' ? '…' : status === 'refunded' ? '↺' : '✕'
  return (
    <Badge tone={tone}>
      {icon} {PAYMENT_LABEL[status]}
    </Badge>
  )
}

export function PhotoBadge({ status }: { status: PhotoStatus }) {
  const tone = status === 'approved' ? 'ok' : status === 'pending' ? 'warn' : status === 'rejected' ? 'bad' : 'neutral'
  return <Badge tone={tone}>{PHOTO_LABEL[status]}</Badge>
}

export function StatTile({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <div className="a-kpi__label">{label}</div>
      <div className="a-kpi__value">{value}</div>
      {hint ? <div className="a-kpi__hint">{hint}</div> : null}
    </>
  )
  return href ? (
    <Link href={href} className="a-kpi">
      {body}
    </Link>
  ) : (
    <div className="a-kpi">{body}</div>
  )
}

export function Tabs({ items, current }: { items: { href: string; label: string; count?: number; key: string }[]; current: string }) {
  return (
    <nav className="a-tabs" aria-label="Filtros">
      {items.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === current ? 'page' : undefined}>
          {t.label}
          {t.count !== undefined ? <span>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="a-empty">{children}</div>
}
