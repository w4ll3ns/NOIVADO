import 'server-only'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { processImage } from '@/lib/images'
import { storage } from '@/lib/storage'

export type MediaRow = typeof schema.media.$inferSelect
export type MediaVariant = 'web' | 'thumb' | 'original' | 'audio'

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

export class AudioError extends Error {}

/** Formato pelo conteúdo do arquivo (não pela extensão): MP3, AAC ou M4A — os que tocam em todo celular. */
function audioType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') return { mime: 'audio/mpeg', ext: 'mp3' }
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' }
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    // quadro MPEG: camada 00 = AAC (ADTS); as demais = MP3
    return (buf[1] & 0x06) === 0 ? { mime: 'audio/aac', ext: 'aac' } : { mime: 'audio/mpeg', ext: 'mp3' }
  }
  return null
}

/** Salva a música de fundo enviada pelo admin, como veio (servida em /m/{id}/audio). */
export async function saveAudio(file: File): Promise<MediaRow> {
  const buf = Buffer.from(await file.arrayBuffer())
  const type = audioType(buf)
  if (!type) throw new AudioError('Formato não suportado. Envie a música em MP3 (ou M4A).')
  const id = randomUUID()
  const key = `media/${id}/musica.${type.ext}`
  await storage().put(key, buf, type.mime)
  const [row] = await db
    .insert(schema.media)
    .values({ id, originalKey: key, webKey: key, thumbKey: key, mime: type.mime, width: 0, height: 0, bytes: buf.length })
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
