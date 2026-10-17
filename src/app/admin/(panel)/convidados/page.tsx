import type { Metadata } from 'next'
import Link from 'next/link'
import { and, asc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { Badge, Empty, PageHead, Tabs } from '@/components/admin/ui'
import { FilterSelect } from '@/components/admin/ClientBits'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { formatPhone, fullName } from '@/lib/format'

export const metadata: Metadata = { title: 'Convidados' }

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'yes', label: 'Confirmados' },
  { key: 'no', label: 'Não comparecerão' },
  { key: 'pending', label: 'Aguardando' },
] as const

export default async function GuestsPage(props: PageProps<'/admin/convidados'>) {
  await requireAdmin()
  const sp = await props.searchParams
  const filter = typeof sp.presenca === 'string' ? sp.presenca : 'todos'
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const telefone = sp.telefone === 'sem' || sp.telefone === 'com' ? sp.telefone : ''
  const g = schema.guests
  const i = schema.invitations
  const conds = [isNull(g.removedAt), isNull(i.archivedAt)]
  if (filter === 'yes' || filter === 'no' || filter === 'pending') conds.push(eq(g.attendance, filter))
  // Sem telefone: a pessoa não tem número próprio (o do convite aparece ao lado, se houver).
  if (telefone === 'sem') conds.push(isNull(g.phone))
  else if (telefone === 'com') conds.push(isNotNull(g.phone))
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`
    conds.push(or(sql`(${g.firstName} || ' ' || coalesce(${g.lastName}, '')) ilike ${like}`, ilike(i.label, like))!)
  }
  const rows = await db
    .select({
      g,
      label: i.label,
      invId: i.id,
      invPhone: i.phone,
      dietary: sql<string | null>`(select r.dietary_restrictions from rsvps r where r.invitation_id = ${i.id} order by r.created_at desc limit 1)`,
      needs: sql<string | null>`(select r.special_needs from rsvps r where r.invitation_id = ${i.id} order by r.created_at desc limit 1)`,
    })
    .from(g)
    .innerJoin(i, eq(i.id, g.invitationId))
    .where(and(...conds))
    .orderBy(asc(g.firstName), asc(g.lastName))
  const [counts] = await db
    .select({
      todos: sql<number>`count(*)`,
      yes: sql<number>`count(*) filter (where ${g.attendance} = 'yes')`,
      no: sql<number>`count(*) filter (where ${g.attendance} = 'no')`,
      pending: sql<number>`count(*) filter (where ${g.attendance} = 'pending')`,
    })
    .from(g)
    .innerJoin(i, eq(i.id, g.invitationId))
    .where(and(isNull(g.removedAt), isNull(i.archivedAt)))

  return (
    <>
      <PageHead
        title="Convidados"
        subtitle="Cada pessoa, com a presença informada no convite."
        actions={
          <>
            <a className="a-btn" href="/api/admin/export/convidados?format=xlsx">
              Excel
            </a>
            <a className="a-btn" href="/api/admin/export/convidados?format=csv">
              CSV
            </a>
          </>
        }
      />
      <Tabs
        current={filter}
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: `/admin/convidados?presenca=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ''}${telefone ? `&telefone=${telefone}` : ''}`,
          count: Number(counts[f.key]),
        }))}
      />
      <form key={JSON.stringify([filter, q, telefone])} className="a-filters" role="search">
        <input type="hidden" name="presenca" value={filter} />
        <label className="a-field" style={{ flex: 1, minWidth: 220 }}>
          <span>Buscar</span>
          <input className="a-input" name="q" defaultValue={q} placeholder="Nome ou convite" />
        </label>
        <FilterSelect
          name="telefone"
          label="Telefone"
          value={telefone}
          options={[
            { value: '', label: 'Todos' },
            { value: 'sem', label: 'Sem telefone próprio' },
            { value: 'com', label: 'Com telefone' },
          ]}
        />
        <button className="a-btn">Filtrar</button>
        {telefone || q ? (
          <Link className="a-btn a-btn--ghost" href={`/admin/convidados?presenca=${filter}`}>
            Limpar
          </Link>
        ) : null}
      </form>
      {telefone || q ? (
        <p className="a-muted" style={{ margin: '-4px 0 10px' }}>
          {rows.length === 1 ? '1 pessoa encontrada' : `${rows.length} pessoas encontradas`}
        </p>
      ) : null}
      <div className="a-table-wrap">
        {rows.length ? (
          <table className="a-table a-table--cards">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Convite</th>
                <th>Presença</th>
                <th>Telefone</th>
                <th>Restrição / necessidade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.g.id}>
                  <td className="col-main">
                    <strong>{fullName(r.g.firstName, r.g.lastName)}</strong>{' '}
                    {r.g.isCompanion ? <Badge>Acompanhante</Badge> : null} {r.g.isChild ? <Badge>Criança</Badge> : null}
                  </td>
                  <td data-label="Convite">
                    <Link href={`/admin/convites/${r.invId}`}>{r.label}</Link>
                  </td>
                  <td data-label="Presença">
                    {r.g.attendance === 'yes' ? <Badge tone="ok">✓ Confirmado</Badge> : r.g.attendance === 'no' ? <Badge tone="bad">✕ Não comparecerá</Badge> : <Badge tone="warn">… Aguardando</Badge>}
                  </td>
                  <td data-label="Telefone" className="nowrap">
                    {r.g.phone ? formatPhone(r.g.phone) : r.invPhone ? <small>{formatPhone(r.invPhone)} (convite)</small> : '—'}
                  </td>
                  <td data-label="Restrição">
                    {[r.dietary, r.needs].filter(Boolean).join(' · ') || <small>—</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Nenhum convidado encontrado.</Empty>
        )}
      </div>
    </>
  )
}
