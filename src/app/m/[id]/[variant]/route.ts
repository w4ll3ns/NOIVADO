import { getMedia } from '@/lib/media'
import { storage } from '@/lib/storage'

const UUID = /^[0-9a-f-]{36}$/

export async function GET(_req: Request, ctx: RouteContext<'/m/[id]/[variant]'>) {
  const { id, variant } = await ctx.params
  if (!UUID.test(id) || !['web', 'thumb'].includes(variant)) return new Response('Não encontrado', { status: 404 })
  const media = await getMedia(id)
  if (!media) return new Response('Não encontrado', { status: 404 })
  const obj = await storage().getStream(variant === 'thumb' ? media.thumbKey : media.webKey)
  if (!obj) return new Response('Não encontrado', { status: 404 })
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/webp',
      ...(obj.size ? { 'Content-Length': String(obj.size) } : {}),
      // O arquivo de um id nunca muda: cache longo.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
