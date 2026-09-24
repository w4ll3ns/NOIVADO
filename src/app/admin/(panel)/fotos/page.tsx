import type { Metadata } from 'next'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { Empty, PageHead, Tabs } from '@/components/admin/ui'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { PHOTO_STATUSES, type PhotoStatus } from '@/lib/db/schema'
import { formatDateTimeCompact } from '@/lib/format'
import { PhotoGrid } from './PhotoGrid'

export const metadata: Metadata = { title: 'Fotos' }

const LABELS: Record<string, string> = { todas: 'Todas', pending: 'Pendentes', approved: 'Aprovadas', hidden: 'Ocultas', rejected: 'Rejeitadas' }

export default async function PhotosAdminPage(props: PageProps<'/admin/fotos'>) {
  const admin = await requireAdmin()
  const sp = await props.searchParams
  const status = typeof sp.status === 'string' && (PHOTO_STATUSES as readonly string[]).includes(sp.status) ? (sp.status as PhotoStatus) : sp.status === 'todas' ? 'todas' : 'pending'
  const conds: SQL[] = []
  if (status !== 'todas') conds.push(eq(schema.photos.status, status))
  const [rows, countsRows] = await Promise.all([
    db
      .select({ p: schema.photos, label: schema.invitations.label })
      .from(schema.photos)
      .leftJoin(schema.invitations, eq(schema.invitations.id, schema.photos.invitationId))
      .where(and(...conds))
      .orderBy(desc(schema.photos.createdAt))
      .limit(600),
    db.select({ status: schema.photos.status, n: sql<number>`count(*)` }).from(schema.photos).groupBy(schema.photos.status),
  ])
  const counts: Record<string, number> = { todas: 0 }
  for (const c of countsRows) {
    counts[c.status] = Number(c.n)
    counts.todas += Number(c.n)
  }

  return (
    <>
      <PageHead
        title="Fotos do álbum"
        subtitle="Nenhuma foto aparece na galeria pública sem estar aprovada. Os originais ficam guardados."
        actions={
          <>
            <a className="a-btn a-btn--primary" href="/api/admin/fotos/zip?status=approved">
              Baixar álbum (aprovadas)
            </a>
            <a className="a-btn" href="/api/admin/fotos/zip?status=todas">
              Baixar tudo
            </a>
          </>
        }
      />
      <Tabs current={status} items={['pending', 'approved', 'hidden', 'rejected', 'todas'].map((k) => ({ key: k, label: LABELS[k], href: `/admin/fotos?status=${k}`, count: counts[k] ?? 0 }))} />
      {rows.length ? (
        <PhotoGrid
          canEdit={hasRole(admin, 'editor')}
          items={rows.map(({ p, label }) => ({
            id: p.id,
            status: p.status,
            name: p.uploaderName,
            showName: p.showNamePublicly,
            date: formatDateTimeCompact(p.createdAt),
            source: p.source,
            invitation: label,
          }))}
        />
      ) : (
        <Empty>Nenhuma foto aqui.</Empty>
      )}
    </>
  )
}
