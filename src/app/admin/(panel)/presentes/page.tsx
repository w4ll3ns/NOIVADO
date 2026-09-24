import type { Metadata } from 'next'
import Link from 'next/link'
import { asc, isNull } from 'drizzle-orm'
import { Badge, PageHead } from '@/components/admin/ui'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { availabilityOf, giftCounts } from '@/lib/gifts'
import { formatBRL, formatBRLShort } from '@/lib/format'
import { saveCategoryAction, toggleGiftAction } from './actions'

export const metadata: Metadata = { title: 'Presentes' }

export default async function GiftsAdminPage(props: PageProps<'/admin/presentes'>) {
  const admin = await requireAdmin()
  const sp = await props.searchParams
  const showArchived = sp.arquivados === '1'
  const canEdit = hasRole(admin, 'editor')
  const [categories, gifts] = await Promise.all([
    db.select().from(schema.giftCategories).orderBy(asc(schema.giftCategories.sortOrder)),
    db.select().from(schema.gifts).where(showArchived ? undefined : isNull(schema.gifts.archivedAt)).orderBy(asc(schema.gifts.sortOrder), asc(schema.gifts.name)),
  ])
  const counts = await giftCounts()
  const catName = new Map(categories.map((c) => [c.id, c.name]))

  return (
    <>
      <PageHead
        title="Presentes"
        subtitle={`${gifts.filter((g) => g.isActive).length} ativos · ${categories.length} categorias`}
        actions={
          <>
            {canEdit ? (
              <Link href="/admin/presentes/novo" className="a-btn a-btn--primary">
                + Novo presente
              </Link>
            ) : null}
            <Link href={showArchived ? '/admin/presentes' : '/admin/presentes?arquivados=1'} className="a-btn">
              {showArchived ? 'Ocultar arquivados' : 'Ver arquivados'}
            </Link>
            <a className="a-btn" href="/api/admin/export/presentes?format=xlsx">
              Excel
            </a>
          </>
        }
      />
      {sp.salvo === '1' ? <p className="a-alert a-alert--ok" style={{ marginBottom: 14 }}>Presente salvo.</p> : null}

      <div className="a-table-wrap">
        <table className="a-table a-table--cards">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Presente</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Disponibilidade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {gifts.map((g) => {
              const c = counts.get(g.id)
              const avail = availabilityOf(g, c)
              return (
                <tr key={g.id}>
                  <td className="num">{g.sortOrder}</td>
                  <td className="col-main">
                    <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <EngravedIcon name={g.icon} size={30} />
                      <span>
                        <Link href={`/admin/presentes/${g.id}`}>{g.name}</Link>
                        {g.featured ? (
                          <>
                            {' '}
                            <Badge tone="accent">Destaque</Badge>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td data-label="Categoria">{g.categoryId ? catName.get(g.categoryId) : <small>—</small>}</td>
                  <td data-label="Valor" className="nowrap">
                    {g.priceType === 'fixed' ? formatBRL(g.amountCents) : <>Personalizado{g.minCents ? <small> · mín. {formatBRLShort(g.minCents)}</small> : null}</>}
                  </td>
                  <td data-label="Disponibilidade">
                    {g.availability === 'unlimited' ? 'Múltiplas' : g.availability === 'unique' ? 'Único' : `Limitado (${g.quantity})`}
                    <br />
                    <small>
                      {c?.approved ?? 0} dado(s){c?.reserved ? ` · ${c.reserved} reservado(s)` : ''}
                      {!avail.available ? ' · esgotado' : ''}
                    </small>
                  </td>
                  <td data-label="Status">
                    {g.archivedAt ? <Badge tone="bad">Arquivado</Badge> : g.isActive ? <Badge tone="ok">Ativo</Badge> : <Badge>Inativo</Badge>}
                  </td>
                  <td>
                    {canEdit ? (
                      <div className="a-row-actions">
                        <Link className="a-btn a-btn--sm" href={`/admin/presentes/${g.id}`}>
                          Editar
                        </Link>
                        <form action={toggleGiftAction}>
                          <input type="hidden" name="id" value={g.id} />
                          <button className="a-btn a-btn--sm" name="field" value="isActive">
                            {g.isActive ? 'Desativar' : 'Ativar'}
                          </button>
                        </form>
                        <form action={toggleGiftAction}>
                          <input type="hidden" name="id" value={g.id} />
                          <button className="a-btn a-btn--sm" name="field" value="archive">
                            {g.archivedAt ? 'Restaurar' : 'Arquivar'}
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section className="a-card" style={{ marginTop: 18 }}>
        <h2 className="a-card__title">Categorias</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {[...categories, null].map((c) => (
            <form key={c?.id ?? 'new'} action={saveCategoryAction} className="a-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'end', borderTop: '1px solid var(--a-line)', paddingTop: 10 }}>
              <input type="hidden" name="id" value={c?.id ?? ''} />
              <label className="a-field" style={{ gridColumn: 'span 2' }}>
                <span>{c ? 'Nome' : 'Nova categoria'}</span>
                <input className="a-input" name="name" defaultValue={c?.name ?? ''} required disabled={!canEdit} />
              </label>
              <label className="a-field" style={{ gridColumn: 'span 2' }}>
                <span>Descrição</span>
                <input className="a-input" name="description" defaultValue={c?.description ?? ''} disabled={!canEdit} />
              </label>
              <label className="a-field">
                <span>Ordem</span>
                <input className="a-input" type="number" name="sortOrder" defaultValue={c?.sortOrder ?? categories.length} disabled={!canEdit} />
              </label>
              <label className="a-check">
                <input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} disabled={!canEdit} /> Ativa
              </label>
              {canEdit ? <button className="a-btn a-btn--sm">{c ? 'Salvar' : 'Adicionar'}</button> : null}
            </form>
          ))}
        </div>
      </section>
    </>
  )
}
