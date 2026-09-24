import type { Metadata } from 'next'
import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { PageHead, StatTile } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { giftStats, invitationStats, messageStats, photoStats } from '@/lib/admin/stats'
import { eventLabel } from '@/lib/admin/labels'
import { expireStalePayments } from '@/lib/payments/service'
import { getSettings } from '@/lib/settings'
import { daysUntil, formatBRL, formatDateLong, formatDateTimeCompact } from '@/lib/format'

export const metadata: Metadata = { title: 'Dashboard' }

const nf = new Intl.NumberFormat('pt-BR')

export default async function DashboardPage() {
  await requireAdmin()
  await expireStalePayments()
  const [inv, gifts, photos, msgs, settings, recent, journey] = await Promise.all([
    invitationStats(),
    giftStats(),
    photoStats(),
    messageStats(),
    getSettings(),
    db
      .select({ e: schema.invitationEvents, label: schema.invitations.label, invId: schema.invitations.id })
      .from(schema.invitationEvents)
      .innerJoin(schema.invitations, eq(schema.invitations.id, schema.invitationEvents.invitationId))
      .where(sql`${schema.invitationEvents.type} not in ('created','updated')`)
      .orderBy(desc(schema.invitationEvents.createdAt))
      .limit(14),
    db.execute<{ gifts: number; messages: number; photos: number }>(sql`
      select
        (select count(distinct invitation_id) from gift_payments where status = 'approved' and invitation_id is not null) as gifts,
        (select count(distinct invitation_id) from messages where invitation_id is not null) as messages,
        (select count(distinct invitation_id) from photos where invitation_id is not null) as photos`),
  ])
  const j = journey[0] ?? { gifts: 0, messages: 0, photos: 0 }
  const days = daysUntil(settings.event.date)
  const max = Math.max(1, inv.total)
  const funnel = [
    { label: 'Convites', value: inv.total, href: '/admin/convites', main: true },
    { label: 'Enviados', value: inv.sent, href: '/admin/convites?filtro=enviados', main: true },
    { label: 'Link acessado', value: inv.accessed, href: '/admin/convites?filtro=todos', main: true },
    { label: 'Enviados e ainda não acessados', value: inv.sentNotAccessed, href: '/admin/convites?filtro=nao-acessados' },
    { label: 'Acessaram e não confirmaram', value: inv.accessedPending, href: '/admin/convites?filtro=acessaram-nao-confirmaram' },
    { label: 'Confirmados', value: inv.attending, href: '/admin/convites?filtro=confirmados', main: true },
    { label: 'Não comparecerão', value: inv.declined, href: '/admin/convites?filtro=nao-comparecerao' },
  ]
  const pct = (v: number) => `${Math.round((v / max) * 100)}%`

  return (
    <>
      <PageHead
        title="Dashboard"
        subtitle={`${formatDateLong(settings.event.date)} · ${days > 0 ? `faltam ${days} dias` : days === 0 ? 'é hoje!' : 'evento realizado'}`}
        actions={
          <>
            <Link href="/admin/convites?filtro=acessaram-nao-confirmaram" className="a-btn">
              Lembretes pendentes ({inv.accessedPending})
            </Link>
            <Link href="/admin/whatsapp#fila" className="a-btn a-btn--wa">
              Envio em sequência
            </Link>
          </>
        }
      />

      <div className="a-grid a-grid--main">
        <section className="a-card">
          <h2 className="a-card__title">
            Funil de convidados <small>clique para filtrar</small>
          </h2>
          <ol className="a-funnel">
            {funnel.map((f) => (
              <li key={f.label}>
                <Link href={f.href} aria-label={`${f.label}: ${f.value} de ${inv.total}`}>
                  <span className="a-funnel__label">{f.label}</span>
                  <span className="a-funnel__track">
                    <span className={`a-funnel__bar${f.main ? '' : ' a-funnel__bar--soft'}`} style={{ width: `calc(${pct(f.value)} - 40px)` }} />
                    <span className="a-funnel__value">
                      {nf.format(f.value)}
                      <small>{pct(f.value)}</small>
                    </span>
                  </span>
                  <span className="a-tip" role="tooltip">
                    {f.label}: {nf.format(f.value)} de {nf.format(inv.total)} convites ({pct(f.value)})
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="a-help" style={{ marginTop: 12 }}>
            “Link acessado” indica que o link do convite foi aberto em um navegador — ele pode ter sido encaminhado a outra pessoa.
          </p>
        </section>

        <section className="a-card">
          <h2 className="a-card__title">Atividade recente</h2>
          {recent.length ? (
            <ol className="a-timeline">
              {recent.map(({ e, label, invId }) => (
                <li key={e.id}>
                  <time>{formatDateTimeCompact(e.createdAt)}</time>
                  <Link href={`/admin/convites/${invId}#historico`}>{label}</Link> — {eventLabel(e.type, e.data)}
                </li>
              ))}
            </ol>
          ) : (
            <p className="a-muted">Nada por aqui ainda. Comece enviando os convites.</p>
          )}
        </section>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="a-kpi-group">
          <h2 className="a-kpi-group__title">Convites</h2>
          <div className="a-kpis">
            <StatTile label="Total" value={nf.format(inv.total)} href="/admin/convites" />
            <StatTile label="Enviados" value={nf.format(inv.sent)} href="/admin/convites?filtro=enviados" />
            <StatTile label="Não enviados" value={nf.format(inv.notSent)} href="/admin/convites?filtro=nao-enviados" />
            <StatTile label="Acessados" value={nf.format(inv.accessed)} />
            <StatTile label="Não acessados" value={nf.format(inv.notAccessed)} href="/admin/convites?filtro=nao-acessados" />
            <StatTile label="Acessaram e não confirmaram" value={nf.format(inv.accessedPending)} href="/admin/convites?filtro=acessaram-nao-confirmaram" />
          </div>
        </div>
        <div className="a-kpi-group">
          <h2 className="a-kpi-group__title">Presenças</h2>
          <div className="a-kpis a-kpis--4">
            <StatTile label="Convites confirmados" value={nf.format(inv.attending)} href="/admin/convites?filtro=confirmados" />
            <StatTile label="Não comparecerão" value={nf.format(inv.declined)} href="/admin/convites?filtro=nao-comparecerao" />
            <StatTile label="Pendentes" value={nf.format(inv.pending)} href="/admin/convites?filtro=pendentes" />
            <StatTile
              label="Pessoas confirmadas"
              value={nf.format(inv.peopleConfirmed)}
              hint={`de ${nf.format(inv.peopleInvited)} convidados${inv.companions ? ` · ${inv.companions} acompanhante(s)` : ''}`}
              href="/admin/convidados?presenca=yes"
            />
          </div>
        </div>
        <div className="a-kpi-group">
          <h2 className="a-kpi-group__title">Presentes</h2>
          <div className="a-kpis a-kpis--5">
            <StatTile label="Valor total recebido" value={formatBRL(gifts.approvedSum)} href="/admin/pagamentos?status=approved" />
            <StatTile label="Presentes recebidos" value={nf.format(gifts.approvedCount)} href="/admin/pagamentos?status=approved" />
            <StatTile label="Aguardando pagamento" value={nf.format(gifts.awaiting)} href="/admin/pagamentos?status=awaiting" />
            <StatTile label="Não concluídos" value={nf.format(gifts.failed)} hint="recusados, cancelados ou expirados" href="/admin/pagamentos" />
            <StatTile label="Ticket médio" value={formatBRL(gifts.average)} />
          </div>
        </div>
        <div className="a-kpi-group">
          <h2 className="a-kpi-group__title">Álbum e mensagens</h2>
          <div className="a-kpis a-kpis--5">
            <StatTile label="Fotos recebidas" value={nf.format(photos.total)} href="/admin/fotos?status=todas" />
            <StatTile label="Aguardando aprovação" value={nf.format(photos.pending)} href="/admin/fotos?status=pending" />
            <StatTile label="Aprovadas" value={nf.format(photos.approved)} href="/admin/fotos?status=approved" />
            <StatTile label="Uploads hoje" value={nf.format(photos.today)} />
            <StatTile label="Mensagens" value={nf.format(msgs.total)} hint={msgs.unread ? `${msgs.unread} não lida(s)` : 'todas lidas'} href="/admin/mensagens" />
          </div>
        </div>
        <div className="a-kpi-group">
          <h2 className="a-kpi-group__title">Jornada dos convites</h2>
          <div className="a-kpis">
            <StatTile label="Cadastrados" value={nf.format(inv.total)} />
            <StatTile label="Enviados" value={nf.format(inv.sent)} />
            <StatTile label="Link acessado" value={nf.format(inv.accessed)} />
            <StatTile label="Confirmados" value={nf.format(inv.attending)} />
            <StatTile label="Com presente" value={nf.format(Number(j.gifts))} />
            <StatTile label="Com mensagem · no álbum" value={`${nf.format(Number(j.messages))} · ${nf.format(Number(j.photos))}`} />
          </div>
        </div>
      </div>
    </>
  )
}
