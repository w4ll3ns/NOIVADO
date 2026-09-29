import { parseRange } from '@/lib/http-range'
import { getMedia, type MediaRow } from '@/lib/media'
import { storage } from '@/lib/storage'

const UUID = /^[0-9a-f-]{36}$/
// O arquivo de um id nunca muda: cache longo.
const CACHE = 'public, max-age=31536000, immutable'

export async function GET(req: Request, ctx: RouteContext<'/m/[id]/[variant]'>) {
  const { id, variant } = await ctx.params
  if (!UUID.test(id) || !['web', 'thumb', 'audio'].includes(variant)) return new Response('Não encontrado', { status: 404 })
  const media = await getMedia(id)
  if (!media) return new Response('Não encontrado', { status: 404 })
  if (variant === 'audio') return audio(req, media)
  if (media.mime.startsWith('audio/')) return new Response('Não encontrado', { status: 404 })
  const obj = await storage().getStream(variant === 'thumb' ? media.thumbKey : media.webKey)
  if (!obj) return new Response('Não encontrado', { status: 404 })
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/webp',
      ...(obj.size ? { 'Content-Length': String(obj.size) } : {}),
      'Cache-Control': CACHE,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function HEAD(req: Request, ctx: RouteContext<'/m/[id]/[variant]'>) {
  const res = await GET(req, ctx)
  await res.body?.cancel()
  return new Response(null, { status: res.status, headers: res.headers })
}

/**
 * A música de fundo, com suporte a Range (206): o Safari do iPhone só toca áudio servido
 * em pedaços, e os navegadores usam isso para começar a tocar antes de baixar tudo.
 */
async function audio(req: Request, media: MediaRow) {
  if (!media.mime.startsWith('audio/')) return new Response('Não encontrado', { status: 404 })
  const total = media.bytes
  const headers: Record<string, string> = {
    'Content-Type': media.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': CACHE,
    'X-Content-Type-Options': 'nosniff',
  }
  const range = parseRange(req.headers.get('range'), total)
  if (range === 'invalid')
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${total}` } })
  const obj = await storage().getStream(media.originalKey, range ?? undefined)
  if (!obj) return new Response('Não encontrado', { status: 404 })
  if (!range) return new Response(obj.body, { headers: { ...headers, 'Content-Length': String(total) } })
  return new Response(obj.body, {
    status: 206,
    headers: {
      ...headers,
      'Content-Range': `bytes ${range.start}-${range.end}/${total}`,
      'Content-Length': String(range.end - range.start + 1),
    },
  })
}
