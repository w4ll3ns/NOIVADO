import 'server-only'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { processImage } from '@/lib/images'
import { storage } from '@/lib/storage'

export type MediaRow = typeof schema.media.$inferSelect
export type MediaVariant = 'web' | 'thumb' | 'original'

export function mediaUrl(id: string | null | undefined, variant: MediaVariant = 'web') {
  return id ? `/m/${id}/${variant}` : null
}

/** Salva uma imagem enviada pelo admin (presentes, história, galeria do casal, dress code). */
export async function saveMedia(file: File, alt?: string | null): Promise<MediaRow> {
  const buf = Buffer.from(await file.arrayBuffer())
  const img = await processImage(buf, { webMax: 1800, thumbMax: 720 })
  const id = randomUUID()
  const base = `media/${id}`
  const originalKey = `${base}/original.${img.original.ext}`
  await Promise.all([
    storage().put(originalKey, img.original.data, img.original.mime),
    storage().put(`${base}/web.webp`, img.web, 'image/webp'),
    storage().put(`${base}/thumb.webp`, img.thumb, 'image/webp'),
  ])
  const [row] = await db
    .insert(schema.media)
    .values({
      id,
      originalKey,
      webKey: `${base}/web.webp`,
      thumbKey: `${base}/thumb.webp`,
      mime: img.original.mime,
      width: img.width,
      height: img.height,
      bytes: buf.length,
      dominantColor: img.dominantColor,
      alt: alt ?? null,
    })
    .returning()
  return row
}

export async function getMediaMap(ids: (string | null | undefined)[]) {
  const list = [...new Set(ids.filter((x): x is string => !!x))]
  if (!list.length) return new Map<string, MediaRow>()
  const rows = await db.select().from(schema.media).where(inArray(schema.media.id, list))
  return new Map(rows.map((r) => [r.id, r]))
}

export async function getMedia(id: string) {
  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id))
  return row ?? null
}
