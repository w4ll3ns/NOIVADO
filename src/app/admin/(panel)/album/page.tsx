import type { Metadata } from 'next'
import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import { Badge, PageHead, StatTile } from '@/components/admin/ui'
import { ConfirmSubmit, CopyButton } from '@/components/admin/ClientBits'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { getMainAlbum } from '@/lib/content'
import { albumUploadState } from '@/lib/album-state'
import { photoStats } from '@/lib/admin/stats'
import { env } from '@/lib/env'
import { formatDateTimeCompact } from '@/lib/format'
import { AlbumSettingsForm } from './AlbumSettingsForm'
import { createAlbumTokenAction, revokeAlbumTokenAction, saveAlbumAction } from './actions'

export const metadata: Metadata = { title: 'Álbum' }

const STATE_LABEL = { open: 'Recebendo fotos', not_started: 'Aguardando a data inicial', closed: 'Encerrado para novos envios', draft: 'Rascunho' } as const

function toLocal(d: Date | null) {
  if (!d) return ''
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 16)
}

export default async function AlbumAdminPage() {
  const admin = await requireAdmin()
  const album = await getMainAlbum()
  if (!album) return <p>Nenhum álbum. Rode <code>npm run db:seed</code>.</p>
  const canEdit = hasRole(admin, 'editor')
  const [tokens, stats] = await Promise.all([
    db.select().from(schema.albumTokens).where(eq(schema.albumTokens.albumId, album.id)).orderBy(asc(schema.albumTokens.createdAt)),
    photoStats(),
  ])
  const state = albumUploadState(album)

  return (
    <>
      <PageHead
        title="Álbum colaborativo"
        subtitle={
          <>
            <Badge tone={state === 'open' ? 'ok' : state === 'closed' ? 'bad' : 'warn'}>{STATE_LABEL[state]}</Badge> · fotos entram pelo QR Code, sem login.
          </>
        }
        actions={
          <Link href="/admin/fotos?status=pending" className="a-btn a-btn--primary">
            Moderar fotos ({stats.pending})
          </Link>
        }
      />
      <div className="a-kpis a-kpis--4" style={{ marginBottom: 16 }}>
        <StatTile label="Fotos recebidas" value={stats.total} />
        <StatTile label="Aguardando aprovação" value={stats.pending} href="/admin/fotos?status=pending" />
        <StatTile label="Aprovadas" value={stats.approved} href="/admin/fotos?status=approved" />
        <StatTile label="Uploads hoje" value={stats.today} />
      </div>

      <div className="a-grid a-grid--main">
        <AlbumSettingsForm
          action={saveAlbumAction.bind(null, album.id)}
          readOnly={!canEdit}
          album={{
            name: album.name,
            description: album.description ?? '',
            closedMessage: album.closedMessage ?? '',
            status: album.status,
            uploadsEnabled: album.uploadsEnabled,
            publicGalleryEnabled: album.publicGalleryEnabled,
            requireApproval: album.requireApproval,
            allowAnonymous: album.allowAnonymous,
            allowGalleryUpload: album.allowGalleryUpload,
            allowCamera: album.allowCamera,
            allowMultiple: album.allowMultiple,
            startsAt: toLocal(album.startsAt),
            endsAt: toLocal(album.endsAt),
          }}
        />

        <section className="a-card" id="qr">
          <h2 className="a-card__title">
            QR Codes <small>um por local, se quiser saber de onde vêm as fotos</small>
          </h2>
          <ul className="a-list-plain">
            {tokens.map((t) => {
              const url = `${env.appUrl}/a/${t.token}`
              return (
                <li key={t.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{t.label}</strong>
                    <span className="a-muted">
                      {t.scanCount} acesso(s) · criado {formatDateTimeCompact(t.createdAt)} {t.revokedAt ? <Badge tone="bad">Desativado</Badge> : null}
                    </span>
                  </div>
                  <p className="a-code" style={{ margin: '6px 0' }}>
                    {url}
                  </p>
                  <div className="a-row-actions">
                    <a className="a-btn a-btn--sm" href={`/api/admin/qr/${t.id}?format=png`}>
                      Baixar PNG
                    </a>
                    <a className="a-btn a-btn--sm" href={`/api/admin/qr/${t.id}?format=svg`}>
                      Baixar SVG
                    </a>
                    <a className="a-btn a-btn--sm" href={`/api/admin/qr/${t.id}?format=pdf`}>
                      PDF para impressão
                    </a>
                    <a className="a-btn a-btn--sm" href={`/admin/album/imprimir/${t.id}`} target="_blank" rel="noreferrer">
                      Versão para imprimir
                    </a>
                    <CopyButton text={url} label="Copiar link" />
                    {canEdit ? (
                      <form action={revokeAlbumTokenAction}>
                        <input type="hidden" name="id" value={t.id} />
                        {t.revokedAt ? (
                          <button className="a-btn a-btn--sm" name="restore" value="1">
                            Reativar
                          </button>
                        ) : (
                          <ConfirmSubmit message="Desativar este QR Code? Quem escanear verá um aviso.">Desativar</ConfirmSubmit>
                        )}
                      </form>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          {canEdit ? (
            <form action={createAlbumTokenAction} className="a-filters" style={{ marginTop: 12, marginBottom: 0 }}>
              <input type="hidden" name="albumId" value={album.id} />
              <label className="a-field" style={{ flex: 1 }}>
                <span>Novo QR Code (local)</span>
                <input className="a-input" name="label" placeholder="Mesas, Bar, Entrada, Lounge…" />
              </label>
              <button className="a-btn a-btn--primary">Gerar QR Code</button>
            </form>
          ) : null}
          <p className="a-help" style={{ marginTop: 10 }}>
            O QR continua funcionando depois do encerramento: quem escanear verá a mensagem de encerramento e a galeria.
          </p>
        </section>
      </div>
    </>
  )
}
