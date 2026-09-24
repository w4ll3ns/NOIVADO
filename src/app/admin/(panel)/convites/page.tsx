import type { Metadata } from 'next'
import Link from 'next/link'
import { AccessBadge, Empty, PageHead, RsvpBadge, SentBadge, Tabs } from '@/components/admin/ui'
import { CopyButton } from '@/components/admin/ClientBits'
import { WhatsAppProvider, WhatsAppTrigger } from '@/components/admin/WhatsAppDialog'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { INVITATION_FILTERS } from '@/lib/admin/invitation-filters'
import { invitationStats } from '@/lib/admin/stats'
import { loadInvitationRows, toWaInvitation, whatsappContext } from '@/lib/admin/invitations'
import { formatBRL, formatDateTimeCompact, formatPhone, fullName } from '@/lib/format'
import { KIND_LABEL } from '@/lib/admin/labels'
import { markSentAction, whatsappOpenedAction } from './actions'

export const metadata: Metadata = { title: 'Convites' }

export default async function InvitationsPage(props: PageProps<'/admin/convites'>) {
  const admin = await requireAdmin()
  const sp = await props.searchParams
  const filter = typeof sp.filtro === 'string' ? sp.filtro : 'todos'
  const q = typeof sp.q === 'string' ? sp.q : ''
  const archived = sp.arquivados === '1'
  const [rows, stats, wa] = await Promise.all([loadInvitationRows({ filter, q, archived }), invitationStats(), whatsappContext()])
  const canEdit = hasRole(admin, 'editor')
  const counts: Record<string, number> = {
    todos: stats.total,
    'nao-enviados': stats.notSent,
    enviados: stats.sent,
    'nao-acessados': stats.sentNotAccessed,
    'acessaram-nao-confirmaram': stats.accessedPending,
    confirmados: stats.attending,
    'nao-comparecerao': stats.declined,
    pendentes: stats.pending,
  }
  const qs = (f: string) => `/admin/convites?filtro=${f}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  return (
    <>
      <PageHead
        title="Convites"
        subtitle={`${stats.total} convites · ${stats.peopleInvited} pessoas convidadas · ${stats.peopleConfirmed} confirmadas`}
        actions={
          <>
            {canEdit ? (
              <>
                <Link href="/admin/convites/novo" className="a-btn a-btn--primary">
                  + Novo convite
                </Link>
                <Link href="/admin/convites/importar" className="a-btn">
                  Importar
                </Link>
              </>
            ) : null}
            <a href="/api/admin/export/convites?format=xlsx" className="a-btn">
              Excel
            </a>
            <a href="/api/admin/export/convites?format=csv" className="a-btn">
              CSV
            </a>
          </>
        }
      />

      <Tabs current={archived ? '' : filter} items={INVITATION_FILTERS.map((f) => ({ key: f.key, label: f.label, href: qs(f.key), count: counts[f.key] }))} />

      <form className="a-filters" role="search">
        <input type="hidden" name="filtro" value={filter} />
        <label className="a-field" style={{ flex: 1, minWidth: 220 }}>
          <span>Buscar por nome, grupo ou telefone</span>
          <input className="a-input" name="q" defaultValue={q} placeholder="Ex.: Silva" />
        </label>
        <button className="a-btn">Buscar</button>
        <Link className="a-btn a-btn--ghost" href={archived ? '/admin/convites' : '/admin/convites?arquivados=1'}>
          {archived ? 'Ver ativos' : 'Arquivados'}
        </Link>
      </form>

      <WhatsAppProvider templates={wa.templates} eventValues={wa.eventValues} onOpened={whatsappOpenedAction} onMarkSent={markSentAction}>
        <div className="a-table-wrap">
          {rows.length ? (
            <table className="a-table a-table--cards">
              <thead>
                <tr>
                  <th>Convite</th>
                  <th>Envio · acesso · RSVP</th>
                  <th className="num">Confirmados</th>
                  <th>Presente</th>
                  <th>Último acesso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const reminder = !!r.inv.firstAccessedAt && r.inv.rsvpStatus === 'pending'
                  return (
                    <tr key={r.inv.id}>
                      <td className="col-main">
                        <Link href={`/admin/convites/${r.inv.id}`}>{r.inv.label}</Link>
                        <br />
                        <small>
                          {KIND_LABEL[r.inv.kind]}
                          {r.groupName ? ` · ${r.groupName}` : ''} · {r.guests.map((g) => fullName(g.firstName, g.lastName)).join(', ')}
                        </small>
                        <br />
                        <small className="nowrap">{r.inv.phone ? formatPhone(r.inv.phone) : 'Sem telefone'}</small>
                      </td>
                      <td>
                        <div className="a-stack">
                          <SentBadge sentAt={r.inv.sentAt} />
                          <AccessBadge firstAccessedAt={r.inv.firstAccessedAt} lastAccessedAt={r.inv.lastAccessedAt} count={r.inv.accessCount} />
                          <RsvpBadge status={r.inv.rsvpStatus} />
                        </div>
                      </td>
                      <td data-label="Confirmados" className="num">
                        {r.confirmed}/{r.invitedCount}
                      </td>
                      <td data-label="Presente" style={{ minWidth: 150 }}>
                        {r.gifts.length ? (
                          r.gifts.map((g, idx) => (
                            <div key={idx}>
                              {g.name} <small>{formatBRL(g.amountCents)}</small>
                            </div>
                          ))
                        ) : (
                          <small>—</small>
                        )}
                      </td>
                      <td data-label="Último acesso" className="nowrap">
                        <small>{formatDateTimeCompact(r.inv.lastAccessedAt)}</small>
                      </td>
                      <td className="col-actions">
                        <div className="a-row-actions">
                          {canEdit && r.link ? (
                            <WhatsAppTrigger invitation={toWaInvitation(r)} mode={reminder ? 'reminder' : 'invite'} label={reminder ? 'Enviar lembrete' : 'WhatsApp'} />
                          ) : null}
                          {r.link ? <CopyButton text={r.link} label="Copiar link" /> : null}
                          {r.token ? (
                            <a className="a-btn a-btn--sm" href={`/i/${r.token}?preview=1`} target="_blank" rel="noreferrer">
                              Ver portal
                            </a>
                          ) : null}
                          <Link className="a-btn a-btn--sm" href={`/admin/convites/${r.inv.id}#historico`}>
                            Histórico
                          </Link>
                          {canEdit ? (
                            <Link className="a-btn a-btn--sm" href={`/admin/convites/${r.inv.id}`}>
                              Editar
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <Empty>{q ? 'Nenhum convite encontrado para esta busca.' : 'Nenhum convite neste filtro.'}</Empty>
          )}
        </div>
      </WhatsAppProvider>
    </>
  )
}
