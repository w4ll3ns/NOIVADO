import type { Metadata } from 'next'
import Link from 'next/link'
import { AccessBadge, Empty, PageHead, RsvpBadge, SentBadge, Tabs } from '@/components/admin/ui'
import { CopyButton, FilterSelect } from '@/components/admin/ClientBits'
import { WhatsAppProvider, WhatsAppTrigger } from '@/components/admin/WhatsAppDialog'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { INVITATION_FILTERS, noPhoneSql } from '@/lib/admin/invitation-filters'
import { db, schema } from '@/lib/db'
import { and, asc, isNull, sql } from 'drizzle-orm'
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
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '')
  // Filtros extras: combinam com as abas e com a busca.
  const extra = { telefone: str('telefone'), tipo: str('tipo'), grupo: str('grupo') }
  const [rows, stats, wa, groups, [semTelefone]] = await Promise.all([
    loadInvitationRows({ filter, q, archived, phone: extra.telefone, kind: extra.tipo, group: extra.grupo }),
    invitationStats(),
    whatsappContext(),
    db.select({ id: schema.guestGroups.id, name: schema.guestGroups.name }).from(schema.guestGroups).orderBy(asc(schema.guestGroups.name)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.invitations)
      .where(and(isNull(schema.invitations.archivedAt), noPhoneSql())),
  ])
  const extrasAtivos = Object.values(extra).some(Boolean)
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
  const qs = (f: string) => {
    const p = new URLSearchParams({ filtro: f })
    if (q) p.set('q', q)
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v)
    return `/admin/convites?${p}`
  }

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

      {/* Com filtros extras, os números das abas (de todos os convites) confundiriam: aparece o total encontrado. */}
      <Tabs
        current={archived ? '' : filter}
        items={INVITATION_FILTERS.map((f) => ({ key: f.key, label: f.label, href: qs(f.key), count: extrasAtivos ? undefined : counts[f.key] }))}
      />

      {semTelefone.n && !archived ? (
        <div className="a-alert a-alert--warn a-semtel">
          <span>
            <strong>{semTelefone.n === 1 ? '1 convite está' : `${semTelefone.n} convites estão`} sem telefone</strong> para receber o link.
          </span>
          <span className="a-actions">
            {extra.telefone !== 'sem' ? (
              <Link className="a-btn a-btn--sm" href="/admin/convites?filtro=todos&telefone=sem">
                Ver só esses
              </Link>
            ) : null}
            {canEdit ? (
              <Link className="a-btn a-btn--sm a-btn--primary" href="/admin/convites/telefones">
                Completar telefones
              </Link>
            ) : null}
          </span>
        </div>
      ) : null}

      {/* key: ao navegar (abas, “Ver só esses”), os campos voltam a mostrar os filtros do endereço. */}
      <form key={JSON.stringify([filter, q, archived, extra])} className="a-filters" role="search">
        <input type="hidden" name="filtro" value={filter} />
        {archived ? <input type="hidden" name="arquivados" value="1" /> : null}
        <label className="a-field" style={{ flex: 1, minWidth: 220 }}>
          <span>Buscar por nome, grupo ou telefone</span>
          <input className="a-input" name="q" defaultValue={q} placeholder="Ex.: Silva" />
        </label>
        <FilterSelect
          name="telefone"
          label="Telefone"
          value={extra.telefone}
          options={[
            { value: '', label: 'Todos' },
            { value: 'sem', label: 'Sem telefone' },
            { value: 'com', label: 'Com telefone' },
          ]}
        />
        <FilterSelect
          name="tipo"
          label="Tipo"
          value={extra.tipo}
          options={[{ value: '', label: 'Todos' }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        {groups.length ? (
          <FilterSelect
            name="grupo"
            label="Grupo"
            value={extra.grupo}
            options={[{ value: '', label: 'Todos' }, { value: 'sem', label: 'Sem grupo' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
          />
        ) : null}
        <button className="a-btn">Filtrar</button>
        {extrasAtivos || q ? (
          <Link className="a-btn a-btn--ghost" href={archived ? '/admin/convites?arquivados=1' : `/admin/convites?filtro=${filter}`}>
            Limpar
          </Link>
        ) : null}
        <Link className="a-btn a-btn--ghost" href={archived ? '/admin/convites' : '/admin/convites?arquivados=1'}>
          {archived ? 'Ver ativos' : 'Arquivados'}
        </Link>
      </form>
      {extrasAtivos || q ? (
        <p className="a-muted" style={{ margin: '-4px 0 10px' }}>
          {rows.length === 1 ? '1 convite encontrado' : `${rows.length} convites encontrados`}
        </p>
      ) : null}

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
                        <TelefoneDoConvite row={r} canEdit={canEdit} />
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

/** Telefone para contato: o do convite, senão o de alguém dele; sem nenhum, atalho para completar. */
function TelefoneDoConvite({ row, canEdit }: { row: Awaited<ReturnType<typeof loadInvitationRows>>[number]; canEdit: boolean }) {
  const outro = row.guests.find((g) => g.phone)
  if (row.inv.phone) return <small className="nowrap">{formatPhone(row.inv.phone)}</small>
  if (outro?.phone)
    return (
      <small className="nowrap">
        {formatPhone(outro.phone)} · {outro.firstName}
      </small>
    )
  return (
    <small className="nowrap a-semtel__item">
      Sem telefone
      {canEdit ? (
        <>
          {' · '}
          <Link href={`/admin/convites/telefones#c-${row.inv.id}`}>adicionar</Link>
        </>
      ) : null}
    </small>
  )
}
