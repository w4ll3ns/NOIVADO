import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { getAdmin } from '@/lib/auth/session'
import { env } from '@/lib/env'
import { getSettings } from '@/lib/settings'
import { qrPdf, qrPng, qrSvg } from '@/lib/qr'
import { formatDateDots, slugify } from '@/lib/format'

export async function GET(req: Request, ctx: RouteContext<'/api/admin/qr/[tokenId]'>) {
  if (!(await getAdmin())) return new Response('Não autorizado', { status: 401 })
  const { tokenId } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(tokenId)) return new Response('Não encontrado', { status: 404 })
  const [row] = await db
    .select({ t: schema.albumTokens, album: schema.albums })
    .from(schema.albumTokens)
    .innerJoin(schema.albums, eq(schema.albums.id, schema.albumTokens.albumId))
    .where(eq(schema.albumTokens.id, tokenId))
  if (!row) return new Response('Não encontrado', { status: 404 })
  const url = `${env.appUrl}/a/${row.t.token}`
  const format = new URL(req.url).searchParams.get('format') ?? 'png'
  const base = `qr-album-${slugify(row.t.label) || 'geral'}`
  if (format === 'svg') {
    return new Response(await qrSvg(url), {
      headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="${base}.svg"` },
    })
  }
  if (format === 'pdf') {
    const settings = await getSettings()
    const pdf = await qrPdf({ url, couple: settings.event.coupleNames, dateDots: formatDateDots(settings.event.date), albumName: row.album.name, label: row.t.label })
    return new Response(Buffer.from(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${base}.pdf"` },
    })
  }
  return new Response(new Uint8Array(await qrPng(url)), {
    headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${base}.png"` },
  })
}
