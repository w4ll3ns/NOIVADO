import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionHead } from '@/components/site/SectionHead'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { PhotoWall } from '@/components/album/PhotoWall'
import { getAlbumEntryToken, getCouplePhotos, getMainAlbum } from '@/lib/content'
import { listApprovedPhotos } from '@/lib/album'
import { albumUploadState } from '@/lib/album-state'
import { getCurrentGuest } from '@/lib/invitations'
import { mediaUrl } from '@/lib/media'

export const metadata: Metadata = { title: 'Galeria' }

export default async function GalleryPage() {
  const [couple, album, guest] = await Promise.all([getCouplePhotos(), getMainAlbum(), getCurrentGuest()])
  const page = album?.publicGalleryEnabled ? await listApprovedPhotos(album.id, null, 30) : null
  const uploadToken = album && guest && albumUploadState(album) === 'open' ? await getAlbumEntryToken(album.id) : null

  return (
    <>
      {couple.length ? (
        <section className="section">
          <div className="container">
            <SectionHead eyebrow="Fotos oficiais" title="Nossa história em fotos" />
            <PhotoWall
              label="Fotos do casal"
              initial={couple.map((p) => ({
                id: p.id,
                thumb: mediaUrl(p.mediaId, 'thumb')!,
                full: mediaUrl(p.mediaId, 'web')!,
                width: p.width,
                height: p.height,
                color: p.color,
                caption: p.caption,
              }))}
            />
          </div>
        </section>
      ) : null}

      <section id="album" className={couple.length ? 'section section--cream' : 'section'}>
        <div className="container">
          <SectionHead eyebrow={album?.name ?? 'Álbum colaborativo'} title="Nosso noivado pelos seus olhos." />
          {page && page.photos.length ? (
            <PhotoWall
              label="Fotos enviadas pelos convidados"
              moreUrl="/api/galeria"
              nextCursor={page.nextCursor}
              initial={page.photos.map((p) => ({
                id: p.id,
                thumb: `/p/${p.id}/thumb`,
                full: `/p/${p.id}/web`,
                width: p.width,
                height: p.height,
                color: p.color,
                caption: p.name,
              }))}
            />
          ) : (
            <div className="center-block">
              <EngravedIcon name="camera" size={56} className="teaser-icon" />
              <p className="section-lead">
                {album && !album.publicGalleryEnabled
                  ? 'As fotos do nosso álbum estão guardadas com carinho.'
                  : 'No dia do noivado, as fotos registradas pelos convidados aparecerão aqui.'}
              </p>
            </div>
          )}
          {uploadToken ? (
            <p className="center" style={{ marginTop: 28 }}>
              <Link href={`/a/${uploadToken}`} className="btn btn--primary">
                Enviar minhas fotos
              </Link>
            </p>
          ) : null}
        </div>
      </section>
    </>
  )
}
