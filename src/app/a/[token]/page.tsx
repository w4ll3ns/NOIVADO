import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Casarao } from '@/components/casarao/Casarao'
import { Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { CoupleNames } from '@/components/site/CoupleNames'
import { AlbumCapture } from '@/components/album/AlbumCapture'
import { countScan, findAlbumByToken } from '@/lib/album'
import { albumUploadState } from '@/lib/album-state'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { isBotUserAgent } from '@/lib/request'
import { formatDateDots } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Álbum do noivado',
  robots: { index: false, follow: false },
}

export default async function AlbumPage(props: PageProps<'/a/[token]'>) {
  const { token } = await props.params
  const [found, settings, guest] = await Promise.all([findAlbumByToken(token), getSettings(), getCurrentGuest()])
  const e = settings.event

  if (!found) {
    return (
      <main className="album-page" id="conteudo">
        <div className="album-page__inner">
          <p className="album-title script">Álbum do Noivado</p>
          <Divider />
          <p className="album-sub">Este QR Code não está mais ativo. Procure outro QR Code espalhado pelo casarão.</p>
          <p style={{ marginTop: 20 }}>
            <Link href="/" className="btn">
              Conhecer o site
            </Link>
          </p>
        </div>
      </main>
    )
  }

  const { album } = found
  const ua = (await headers()).get('user-agent')
  if (!isBotUserAgent(ua)) await countScan(found.tokenId)
  const state = albumUploadState(album)
  const galleryHref = album.publicGalleryEnabled ? '/galeria#album' : null
  const defaultName = guest ? guest.greeting : ''

  return (
    <main className="album-page" id="conteudo">
      <FrameCorners />
      <div className="album-page__inner">
        <p className="album-title script">{album.name}</p>
        <p className="caps" style={{ fontSize: '0.8rem' }}>
          <CoupleNames names={e.coupleNames} /> · {formatDateDots(e.date)}
        </p>
        <Casarao forte luzes="acesas" className="album-page__casarao" sizes="300px" />
        <Divider />

        {state === 'open' ? (
          <>
            <h1 className="album-lead">Registre esse momento conosco.</h1>
            <p className="album-sub" style={{ marginBottom: 24 }}>
              {album.description || 'Queremos ver o nosso noivado pelos seus olhos.'}
            </p>
            <AlbumCapture
              token={token}
              allowCamera={album.allowCamera}
              allowGallery={album.allowGalleryUpload}
              allowMultiple={album.allowMultiple}
              requireName={!album.allowAnonymous && !guest}
              requireApproval={album.requireApproval}
              defaultName={defaultName}
              galleryHref={galleryHref}
            />
            <p className="privacy-note" style={{ marginTop: 22 }}>
              As fotos enviadas ficam guardadas no álbum do noivado
              {album.publicGalleryEnabled
                ? album.requireApproval
                  ? ' e podem aparecer na galeria do site depois da aprovação dos noivos'
                  : ' e aparecem na galeria do site'
                : ''}
              . Seu nome só é exibido se você autorizar. <Link href="/privacidade">Privacidade</Link>.
            </p>
          </>
        ) : state === 'not_started' ? (
          <>
            <h1 className="album-lead">O álbum abre no dia da celebração.</h1>
            <p className="album-sub">Guarde este QR Code — no dia {formatDateDots(e.date)}, é só voltar aqui para registrar os momentos.</p>
          </>
        ) : (
          <>
            <h1 className="album-lead">Obrigado por celebrar conosco.</h1>
            <p className="album-sub">
              {album.closedMessage ||
                'Nosso álbum já foi encerrado para novos registros, mas você ainda pode conferir as fotos desse dia especial.'}
            </p>
            {galleryHref ? (
              <p style={{ marginTop: 22 }}>
                <Link href={galleryHref} className="btn btn--primary">
                  Ver as fotos
                </Link>
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}
