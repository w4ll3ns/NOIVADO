import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Facade } from '@/components/casarao/Facade'
import { Divider } from '@/components/ornaments/Ornaments'
import { CoupleNames } from '@/components/site/CoupleNames'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { env } from '@/lib/env'
import { getSettings } from '@/lib/settings'
import { qrSvg } from '@/lib/qr'
import { formatDateDots } from '@/lib/format'
import { monogramFor } from '@/lib/event'
import { PrintButton } from './PrintButton'

export const metadata: Metadata = { title: 'Imprimir QR Code' }

export default async function PrintQrPage(props: PageProps<'/admin/album/imprimir/[tokenId]'>) {
  await requireAdmin()
  const { tokenId } = await props.params
  if (!/^[0-9a-f-]{36}$/.test(tokenId)) notFound()
  const [row] = await db
    .select({ t: schema.albumTokens, album: schema.albums })
    .from(schema.albumTokens)
    .innerJoin(schema.albums, eq(schema.albums.id, schema.albumTokens.albumId))
    .where(eq(schema.albumTokens.id, tokenId))
  if (!row) notFound()
  const settings = await getSettings()
  const url = `${env.appUrl}/a/${row.t.token}`
  const svg = await qrSvg(url)
  const e = settings.event
  const card = (i: number) => (
    <div className="qr-card" key={i}>
      <p className="qr-card__album script">{row.album.name}</p>
      <p className="qr-card__meta">
        <CoupleNames names={e.coupleNames} /> · {formatDateDots(e.date)}
      </p>
      <Facade idPrefix={`print${i}`} className="cz--small qr-card__facade" monogram={monogramFor(e.coupleNames)} />
      <p className="qr-card__lead">Registre esse momento conosco.</p>
      <p className="qr-card__sub">Queremos ver o nosso noivado pelos seus olhos.</p>
      <div className="qr-card__qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="qr-card__hint">Aponte a câmera do celular e envie suas fotos para o nosso álbum.</p>
      <Divider />
    </div>
  )
  return (
    <div className="qr-print">
      <style>{`
        @page { size: A4; margin: 8mm; }
        .qr-print { background: #fff; min-height: 100vh; padding: 16px; font-family: var(--font-text); color: var(--ink); }
        .qr-toolbar { display: flex; gap: 10px; justify-content: center; margin-bottom: 16px; }
        .qr-sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 0; width: 194mm; margin: 0 auto; }
        .qr-card { box-sizing: border-box; height: 138mm; padding: 9mm 8mm; text-align: center; border: 1px dashed #d8cdc2; position: relative; display: flex; flex-direction: column; align-items: center; }
        .qr-card::before { content: ''; position: absolute; inset: 4mm; border: 1px solid var(--line); outline: 1px solid var(--line-soft); outline-offset: -5px; }
        .qr-card__album { font-size: 26pt; margin: 2mm 0 0; }
        .qr-card__meta { font-family: var(--font-title); font-weight: 600; font-size: 7.5pt; letter-spacing: .25em; text-transform: uppercase; color: var(--sepia); margin: 0; }
        .qr-card__facade { width: 44mm; height: auto; margin: 2mm auto 1mm; }
        .qr-card__lead { font-family: var(--font-title); font-size: 13pt; color: var(--ink); margin: 1mm 0 0; }
        .qr-card__sub { font-style: italic; font-size: 9pt; color: var(--ink-soft); margin: 0 0 2mm; }
        .qr-card__qr svg { width: 38mm; height: 38mm; }
        .qr-card__hint { font-style: italic; font-size: 8pt; color: var(--ink-soft); margin: 1mm 6mm 0; }
        .qr-card .orn-divider { width: 34mm; margin: 1mm auto 0; }
        @media print { .qr-toolbar { display: none; } .qr-print { padding: 0; } }
      `}</style>
      <div className="qr-toolbar no-print">
        <PrintButton />
        <span className="a-muted">
          QR “{row.t.label}” · {url}
        </span>
      </div>
      <div className="qr-sheet">{[0, 1, 2, 3].map(card)}</div>
    </div>
  )
}
