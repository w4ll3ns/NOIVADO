import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { Empty, PageHead } from '@/components/admin/ui'
import { ConfirmSubmit } from '@/components/admin/ClientBits'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { galleryPhotoAction } from './actions'

export const metadata: Metadata = { title: 'Galeria do casal' }

export default async function CoupleGalleryAdmin() {
  const admin = await requireAdmin()
  const canEdit = hasRole(admin, 'editor')
  const rows = await db
    .select({ g: schema.galleryPhotos })
    .from(schema.galleryPhotos)
    .innerJoin(schema.media, eq(schema.media.id, schema.galleryPhotos.mediaId))
    .orderBy(asc(schema.galleryPhotos.sortOrder), asc(schema.galleryPhotos.createdAt))
  return (
    <>
      <PageHead
        title="Nossa história em fotos"
        subtitle="Fotos oficiais do casal — separadas do álbum colaborativo. Aparecem na Galeria."
        actions={canEdit ? <MediaUploader purpose="gallery" label="+ Enviar fotos" /> : null}
      />
      {rows.length ? (
        <div className="a-photos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {rows.map(({ g }) => (
            <figure key={g.id} className="a-photo" style={{ margin: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/m/${g.mediaId}/thumb`} alt="" loading="lazy" />
              <form action={galleryPhotoAction} className="a-photo__meta" style={{ display: 'grid', gap: 6 }}>
                <input type="hidden" name="id" value={g.id} />
                <input className="a-input" name="caption" placeholder="Legenda" defaultValue={g.caption ?? ''} disabled={!canEdit} />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="a-input" type="number" name="sortOrder" defaultValue={g.sortOrder} style={{ width: 70 }} disabled={!canEdit} />
                  <label className="a-check">
                    <input type="checkbox" name="isActive" defaultChecked={g.isActive} disabled={!canEdit} /> Visível
                  </label>
                </div>
                {canEdit ? (
                  <div className="a-row-actions">
                    <button className="a-btn a-btn--sm" name="op" value="save">
                      Salvar
                    </button>
                    <ConfirmSubmit message="Remover esta foto da galeria?" name="op" value="delete">
                      Remover
                    </ConfirmSubmit>
                  </div>
                ) : null}
              </form>
            </figure>
          ))}
        </div>
      ) : (
        <Empty>Nenhuma foto ainda. Envie as fotos oficiais do casal.</Empty>
      )}
    </>
  )
}
