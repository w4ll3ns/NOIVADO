import type { Metadata } from 'next'
import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { Empty, PageHead, PaymentBadge, StatTile } from '@/components/admin/ui'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { listPayments } from '@/lib/admin/payments'
import { PAYMENT_LABEL, paymentMethodLabel } from '@/lib/admin/labels'
import { PAYMENT_STATUSES } from '@/lib/db/schema'
import { expireStalePayments } from '@/lib/payments/service'
import { formatBRL, formatDateTimeCompact } from '@/lib/format'
import { env } from '@/lib/env'
import { syncPaymentAction } from './actions'

export const metadata: Metadata = { title: 'Pagamentos' }

export default async function PaymentsPage(props: PageProps<'/admin/pagamentos'>) {
  const admin = await requireAdmin()
  await expireStalePayments()
  const sp = await props.searchParams
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '')
  const filters = { status: str('status'), gift: str('presente'), q: str('q'), from: str('de'), to: str('ate') }
  const [rows, gifts] = await Promise.all([
    listPayments(filters),
    db.select({ id: schema.gifts.id, name: schema.gifts.name }).from(schema.gifts).orderBy(asc(schema.gifts.name)),
  ])
  const approved = rows.filter((r) => r.p.status === 'approved')
  const total = approved.reduce((s, r) => s + r.p.amountCents, 0)
  const exportQs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString()

  return (
    <>
      <PageHead
        title="Pagamentos"
        subtitle={env.mpAccessToken ? 'Status confirmados pelo Mercado Pago (webhook + consulta à API).' : 'Mercado Pago ainda não configurado (MP_ACCESS_TOKEN).'}
        actions={
          <>
            <a className="a-btn" href={`/api/admin/export/pagamentos?format=xlsx&${exportQs}`}>
              Excel
            </a>
            <a className="a-btn" href={`/api/admin/export/pagamentos?format=csv&${exportQs}`}>
              CSV
            </a>
          </>
        }
      />
      <div className="a-kpis a-kpis--4" style={{ marginBottom: 16 }}>
        <StatTile label="Aprovado (filtro atual)" value={formatBRL(total)} />
        <StatTile label="Pagamentos aprovados" value={approved.length} />
        <StatTile label="Aguardando" value={rows.filter((r) => r.p.status === 'awaiting').length} />
        <StatTile label="Ticket médio" value={formatBRL(approved.length ? Math.round(total / approved.length) : 0)} />
      </div>
      <form className="a-filters">
        <label className="a-field">
          <span>De</span>
          <input className="a-input" type="date" name="de" defaultValue={filters.from} />
        </label>
        <label className="a-field">
          <span>Até</span>
          <input className="a-input" type="date" name="ate" defaultValue={filters.to} />
        </label>
        <label className="a-field">
          <span>Status</span>
          <select className="a-select" name="status" defaultValue={filters.status}>
            <option value="">Todos</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Presente</span>
          <select className="a-select" name="presente" defaultValue={filters.gift}>
            <option value="">Todos</option>
            {gifts.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field" style={{ flex: 1 }}>
          <span>Convidado / e-mail / ID</span>
          <input className="a-input" name="q" defaultValue={filters.q} />
        </label>
        <button className="a-btn">Filtrar</button>
        <Link className="a-btn a-btn--ghost" href="/admin/pagamentos">
          Limpar
        </Link>
      </form>
      <div className="a-table-wrap">
        {rows.length ? (
          <table className="a-table a-table--cards">
            <thead>
              <tr>
                <th>Data</th>
                <th>Convidado</th>
                <th>Presente</th>
                <th className="num">Valor</th>
                <th>Forma</th>
                <th>Status</th>
                <th>ID Mercado Pago</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, invitationLabel }) => (
                <tr key={p.id}>
                  <td className="nowrap">{formatDateTimeCompact(p.createdAt)}</td>
                  <td data-label="Convidado" className="col-main">
                    <strong>{p.payerName}</strong>
                    <br />
                    <small>
                      {p.payerEmail}
                      {invitationLabel ? ` · ${invitationLabel}` : ''}
                    </small>
                  </td>
                  <td data-label="Presente">{p.giftName}</td>
                  <td data-label="Valor" className="num">
                    {formatBRL(p.amountCents)}
                  </td>
                  <td data-label="Forma">{paymentMethodLabel(p.paymentMethod, p.paymentType)}</td>
                  <td data-label="Status">
                    <PaymentBadge status={p.status} />
                    {p.approvedAt ? (
                      <>
                        <br />
                        <small>aprovado {formatDateTimeCompact(p.approvedAt)}</small>
                      </>
                    ) : null}
                    {p.statusDetail?.startsWith('amount_mismatch') ? (
                      <>
                        <br />
                        <small style={{ color: 'var(--rose)' }}>Valor divergente — verifique no Mercado Pago</small>
                      </>
                    ) : null}
                  </td>
                  <td data-label="ID MP">
                    <small className="a-code">{p.mpPaymentId ?? '—'}</small>
                    {p.provider === 'simulation' ? <small> (simulação)</small> : null}
                  </td>
                  <td>
                    {hasRole(admin, 'editor') && p.provider === 'mercadopago' && env.mpAccessToken && p.status === 'awaiting' ? (
                      <form action={syncPaymentAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="a-btn a-btn--sm">Consultar MP</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Nenhum pagamento encontrado.</Empty>
        )}
      </div>
    </>
  )
}
