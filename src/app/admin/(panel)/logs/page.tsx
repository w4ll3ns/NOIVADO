import type { Metadata } from 'next'
import { desc, eq } from 'drizzle-orm'
import { Empty, PageHead } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Registros' }

export default async function LogsPage() {
  await requireAdmin('owner')
  const rows = await db
    .select({ l: schema.auditLogs, name: schema.admins.name })
    .from(schema.auditLogs)
    .leftJoin(schema.admins, eq(schema.admins.id, schema.auditLogs.adminId))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(300)
  return (
    <>
      <PageHead title="Registros administrativos" subtitle="Últimas 300 ações no painel (logins, alterações, exportações)." />
      <div className="a-table-wrap">
        {rows.length ? (
          <table className="a-table a-table--cards">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ l, name }) => (
                <tr key={l.id}>
                  <td className="nowrap">{formatDateTime(l.createdAt)}</td>
                  <td data-label="Quem">{name ?? <small>—</small>}</td>
                  <td data-label="Ação">
                    <code className="a-code">{l.action}</code>
                  </td>
                  <td data-label="Detalhes">
                    <small>{l.details ? JSON.stringify(l.details) : l.entityId ?? ''}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Sem registros.</Empty>
        )}
      </div>
    </>
  )
}
