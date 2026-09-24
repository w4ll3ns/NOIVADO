import type { Metadata } from 'next'
import Link from 'next/link'
import { and, desc, eq, isNotNull, isNull, type SQL } from 'drizzle-orm'
import { Badge, Empty, PageHead, Tabs } from '@/components/admin/ui'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { formatDateTime } from '@/lib/format'
import { messageAction } from './actions'

export const metadata: Metadata = { title: 'Mensagens' }

const SOURCE_LABEL = { rsvp: 'RSVP', gift: 'Presente', guestbook: 'Livro de mensagens' } as const

export default async function MessagesPage(props: PageProps<'/admin/mensagens'>) {
  const admin = await requireAdmin()
  const sp = await props.searchParams
  const origin = typeof sp.origem === 'string' ? sp.origem : 'todas'
  const m = schema.messages
  const conds: (SQL | undefined)[] = [origin === 'arquivadas' ? isNotNull(m.archivedAt) : isNull(m.archivedAt)]
  if (origin === 'rsvp' || origin === 'gift' || origin === 'guestbook') conds.push(eq(m.source, origin))
  if (origin === 'favoritas') conds.push(eq(m.favorite, true))
  const [rows, settings] = await Promise.all([
    db
      .select({ m, label: schema.invitations.label })
      .from(m)
      .leftJoin(schema.invitations, eq(schema.invitations.id, m.invitationId))
      .where(and(...conds))
      .orderBy(desc(m.createdAt))
      .limit(500),
    getSettings(),
  ])
  const canEdit = hasRole(admin, 'editor')

  return (
    <>
      <PageHead
        title={`Mensagens para ${settings.event.coupleNames}`}
        subtitle="Tudo o que os convidados escreveram: na confirmação, nos presentes e no livro de mensagens."
        actions={
          <>
            {canEdit ? (
              <form action={messageAction}>
                <button className="a-btn" name="op" value="all-read">
                  Marcar todas como lidas
                </button>
              </form>
            ) : null}
            <a className="a-btn" href="/api/admin/export/mensagens?format=xlsx">
              Excel
            </a>
            <a className="a-btn" href="/api/admin/export/mensagens?format=csv">
              CSV
            </a>
          </>
        }
      />
      <Tabs
        current={origin}
        items={[
          { key: 'todas', label: 'Todas', href: '/admin/mensagens' },
          { key: 'rsvp', label: 'RSVP', href: '/admin/mensagens?origem=rsvp' },
          { key: 'gift', label: 'Presentes', href: '/admin/mensagens?origem=gift' },
          { key: 'guestbook', label: 'Livro de mensagens', href: '/admin/mensagens?origem=guestbook' },
          { key: 'favoritas', label: '♥ Favoritas', href: '/admin/mensagens?origem=favoritas' },
          { key: 'arquivadas', label: 'Arquivadas', href: '/admin/mensagens?origem=arquivadas' },
        ]}
      />
      {rows.length ? (
        <div className="a-grid a-grid--2">
          {rows.map(({ m: msg, label }) => (
            <article key={msg.id} className={`a-msg${msg.readAt ? '' : ' a-msg--unread'}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{msg.authorName}</strong>
                <span>
                  <Badge tone="accent">{SOURCE_LABEL[msg.source]}</Badge> {msg.favorite ? <Badge tone="ok">♥</Badge> : null}
                </span>
              </div>
              <p className="a-msg__text">{msg.content}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <small className="a-muted">
                  {formatDateTime(msg.createdAt)}
                  {label && msg.invitationId ? (
                    <>
                      {' · '}
                      <Link href={`/admin/convites/${msg.invitationId}`}>{label}</Link>
                    </>
                  ) : null}
                </small>
                {canEdit ? (
                  <form action={messageAction} className="a-row-actions">
                    <input type="hidden" name="id" value={msg.id} />
                    <button className="a-btn a-btn--sm" name="op" value="read">
                      {msg.readAt ? 'Marcar não lida' : 'Marcar lida'}
                    </button>
                    <button className="a-btn a-btn--sm" name="op" value="fav">
                      {msg.favorite ? 'Desfavoritar' : 'Favoritar'}
                    </button>
                    <button className="a-btn a-btn--sm" name="op" value="archive">
                      {msg.archivedAt ? 'Restaurar' : 'Arquivar'}
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty>Nenhuma mensagem aqui.</Empty>
      )}
    </>
  )
}
