import type { Metadata } from 'next'
import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { Badge, Empty, PageHead, RsvpBadge, StatTile, Tabs } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { invitationStats } from '@/lib/admin/stats'
import { formatDateTimeCompact } from '@/lib/format'

export const metadata: Metadata = { title: 'RSVP' }

export default async function RsvpAdminPage(props: PageProps<'/admin/rsvp'>) {
  await requireAdmin()
  const sp = await props.searchParams
  const history = sp.historico === '1'
  const r = schema.rsvps
  const base = db
    .select({ r, label: schema.invitations.label, invId: schema.invitations.id })
    .from(r)
    .innerJoin(schema.invitations, eq(schema.invitations.id, r.invitationId))
  const rows = history
    ? await base.orderBy(desc(r.createdAt)).limit(500)
    : await base
        .where(sql`${r.id} = (select r2.id from rsvps r2 where r2.invitation_id = ${r.invitationId} order by r2.created_at desc limit 1)`)
        .orderBy(desc(r.createdAt))
  const stats = await invitationStats()
  const dietary = rows.filter((x) => x.r.dietaryRestrictions && x.r.status === 'attending')
  const songs = rows.filter((x) => x.r.songRequest)

  return (
    <>
      <PageHead
        title="Confirmações (RSVP)"
        subtitle="Cada envio fica registrado — alterações não apagam o histórico."
        actions={
          <>
            <a className="a-btn" href="/api/admin/export/rsvp?format=xlsx">
              Excel
            </a>
            <a className="a-btn" href="/api/admin/export/rsvp?format=csv">
              CSV
            </a>
          </>
        }
      />
      <div className="a-kpis a-kpis--4" style={{ marginBottom: 16 }}>
        <StatTile label="Pessoas confirmadas" value={stats.peopleConfirmed} hint={`de ${stats.peopleInvited} convidados`} />
        <StatTile label="Convites confirmados" value={stats.attending} />
        <StatTile label="Não comparecerão" value={stats.declined} />
        <StatTile label="Aguardando resposta" value={stats.pending} href="/admin/convites?filtro=pendentes" />
      </div>
      <Tabs
        current={history ? 'h' : 'a'}
        items={[
          { key: 'a', label: 'Resposta atual de cada convite', href: '/admin/rsvp' },
          { key: 'h', label: 'Histórico completo', href: '/admin/rsvp?historico=1' },
        ]}
      />
      <div className="a-table-wrap">
        {rows.length ? (
          <table className="a-table a-table--cards">
            <thead>
              <tr>
                <th>Data</th>
                <th>Convite</th>
                <th>Resposta</th>
                <th className="num">Sim / Não</th>
                <th>Restrição alimentar</th>
                <th>Necessidade especial</th>
                <th>Música</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.r.id}>
                  <td className="nowrap">{formatDateTimeCompact(x.r.createdAt)}</td>
                  <td data-label="Convite" className="col-main">
                    <Link href={`/admin/convites/${x.invId}#rsvp`}>{x.label}</Link>
                  </td>
                  <td data-label="Resposta">
                    <div className="a-stack">
                      <RsvpBadge status={x.r.status} />
                      {x.r.isChange ? <Badge>Alteração</Badge> : null}
                    </div>
                  </td>
                  <td data-label="Sim / Não" className="num">
                    {x.r.attendingCount} / {x.r.declinedCount}
                  </td>
                  <td data-label="Restrição">{x.r.dietaryRestrictions ?? <small>—</small>}</td>
                  <td data-label="Necessidade">{x.r.specialNeeds ?? <small>—</small>}</td>
                  <td data-label="Música">{x.r.songRequest ?? <small>—</small>}</td>
                  <td data-label="Observações">{x.r.notes ?? <small>—</small>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Nenhuma resposta ainda.</Empty>
        )}
      </div>
      {!history && (dietary.length || songs.length) ? (
        <div className="a-grid a-grid--2" style={{ marginTop: 16 }}>
          <section className="a-card">
            <h2 className="a-card__title">Restrições alimentares (confirmados)</h2>
            <ul className="a-list-plain">
              {dietary.map((x) => (
                <li key={x.r.id}>
                  <strong>{x.label}:</strong> {x.r.dietaryRestrictions}
                </li>
              ))}
            </ul>
          </section>
          <section className="a-card">
            <h2 className="a-card__title">Músicas pedidas</h2>
            <ul className="a-list-plain">
              {songs.map((x) => (
                <li key={x.r.id}>
                  {x.r.songRequest} <small className="a-muted">— {x.label}</small>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </>
  )
}
