import { getPhoto, photoDownloadName } from '@/lib/album'
import { getAdmin } from '@/lib/auth/session'
import { storage } from '@/lib/storage'

/**
 * Fotos do álbum colaborativo. Público: apenas miniatura/versão web de fotos APROVADAS
 * (com a galeria pública ligada). Original e fotos não aprovadas: somente o painel.
 */
export async function GET(req: Request, ctx: RouteContext<'/p/[id]/[variant]'>) {
  const { id, variant } = await ctx.params
  if (!['thumb', 'web', 'original'].includes(variant)) return new Response('Não encontrado', { status: 404 })
  const found = await getPhoto(id)
  if (!found) return new Response('Não encontrado', { status: 404 })
  const { photo, publicGallery } = found
  const isPublic = variant !== 'original' && photo.status === 'approved' && publicGallery
  if (!isPublic && !(await getAdmin())) return new Response('Não encontrado', { status: 404 })

  const key = variant === 'thumb' ? photo.thumbKey : variant === 'web' ? photo.webKey : photo.originalKey
  const obj = await storage().getStream(key)
  if (!obj) return new Response('Não encontrado', { status: 404 })
  const download = new URL(req.url).searchParams.get('download') === '1'
  return new Response(obj.body, {
    headers: {
      'Content-Type': variant === 'original' ? photo.mime : 'image/webp',
      ...(obj.size ? { 'Content-Length': String(obj.size) } : {}),
      'Cache-Control': isPublic ? 'public, max-age=600, stale-while-revalidate=3600' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(download ? { 'Content-Disposition': `attachment; filename="${photoDownloadName(photo)}"` } : {}),
    },
  })
}
