import { count } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { getAdmin, hasRole } from '@/lib/auth/session'
import { saveMedia } from '@/lib/media'
import { ImageError } from '@/lib/images'
import { isSameOrigin } from '@/lib/request'
import { cleanLine } from '@/lib/sanitize'
import { env } from '@/lib/env'
import { audit } from '@/lib/audit'

/** Upload de imagens do painel (galeria do casal, história, dress code). */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return Response.json({ error: 'Origem inválida' }, { status: 403 })
  const admin = await getAdmin()
  if (!admin || !hasRole(admin, 'editor')) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || !file.size) return Response.json({ error: 'Arquivo ausente' }, { status: 400 })
  if (file.size > env.maxUploadBytes) return Response.json({ error: 'Arquivo muito grande' }, { status: 413 })
  const purpose = String(form?.get('purpose') ?? '')
  try {
    const media = await saveMedia(file, cleanLine(form?.get('alt'), 200) || null)
    if (purpose === 'gallery') {
      const [{ n }] = await db.select({ n: count() }).from(schema.galleryPhotos)
      await db.insert(schema.galleryPhotos).values({ mediaId: media.id, sortOrder: Number(n) })
    }
    await audit(admin.id, 'media.upload', 'media', media.id, { purpose })
    return Response.json({ id: media.id, url: `/m/${media.id}/thumb` })
  } catch (err) {
    if (err instanceof ImageError) return Response.json({ error: err.message }, { status: 415 })
    console.error(err)
    return Response.json({ error: 'Falha ao salvar a imagem' }, { status: 500 })
  }
}
