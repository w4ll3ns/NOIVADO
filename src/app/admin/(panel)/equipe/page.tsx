import type { Metadata } from 'next'
import { asc } from 'drizzle-orm'
import { Badge, PageHead } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { formatDateTimeCompact } from '@/lib/format'
import { CreateAdminForm } from './Forms'
import { updateAdminAction } from './actions'

export const metadata: Metadata = { title: 'Equipe' }

const ROLE = { owner: 'Proprietário', editor: 'Editor', viewer: 'Leitura' } as const

export default async function TeamPage() {
  const me = await requireAdmin('owner')
  const admins = await db.select().from(schema.admins).orderBy(asc(schema.admins.createdAt))
  return (
    <>
      <PageHead title="Equipe" subtitle="Quem pode acessar o painel. Senhas são guardadas com hash scrypt — ninguém consegue lê-las." />
      <div className="a-table-wrap" style={{ marginBottom: 16 }}>
        <table className="a-table a-table--cards">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Papel</th>
              <th>Último acesso</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="col-main">
                  <strong>{a.name}</strong> {a.disabledAt ? <Badge tone="bad">Desativado</Badge> : null}
                  <br />
                  <small>{a.email}</small>
                </td>
                <td data-label="Papel">{ROLE[a.role]}</td>
                <td data-label="Último acesso">{formatDateTimeCompact(a.lastLoginAt)}</td>
                <td>
                  {a.id !== me.id ? (
                    <div className="a-row-actions">
                      <form action={updateAdminAction} style={{ display: 'flex', gap: 4 }}>
                        <input type="hidden" name="id" value={a.id} />
                        <select className="a-select" name="role" defaultValue={a.role} style={{ minHeight: 30, padding: '2px 6px' }}>
                          <option value="owner">Proprietário</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Leitura</option>
                        </select>
                        <button className="a-btn a-btn--sm" name="op" value="role">
                          Alterar
                        </button>
                      </form>
                      <form action={updateAdminAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="a-btn a-btn--sm" name="op" value={a.disabledAt ? 'enable' : 'disable'}>
                          {a.disabledAt ? 'Reativar' : 'Desativar'}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <small>Você</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="a-card">
        <h2 className="a-card__title">Novo acesso</h2>
        <CreateAdminForm />
      </section>
    </>
  )
}
