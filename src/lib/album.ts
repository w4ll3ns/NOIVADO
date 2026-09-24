import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { processImage } from '@/lib/images'
import { storage } from '@/lib/storage'
import { isValidTokenShape } from '@/lib/security/tokens'

export type Album = typeof schema.albums.$inferSelect
export type Photo = typeof schema.photos.$inferSelect
export type PhotoVariant = 'thumb' | 'web' | 'original'

export function photoUrl(id: string, variant: PhotoVariant = 'web') {
  return `/p/${id}/${variant}`
}

export async function findAlbumByToken(token: string) {
  if (!isValidTokenShape(token, 6, 40)) return null
  const [row] = await db
    .select({ album: schema.albums, tokenId: schema.albumTokens.id, label: schema.albumTokens.label })
    .from(schema.albumTokens)
    .innerJoin(schema.albums, eq(schema.albums.id, schema.albumTokens.albumId))
    .where(and(eq(schema.albumTokens.token, token), isNull(schema.albumTokens.revokedAt)))
    .limit(1)
  return row ?? null
}

export async function countScan(tokenId: string) {
  await db
    .update(schema.albumTokens)
    .set({ scanCount: sql`${schema.albumTokens.scanCount} + 1` })
    .where(eq(schema.albumTokens.id, tokenId))
}

export type PublicPhoto = {
  id: string
  width: number
  height: number
  color: string | null
  name: string | null
  createdAt: string
}

/** Fotos aprovadas, das mais recentes para as mais antigas, com cursor estável. */
export async function listApprovedPhotos(albumId: string, cursor: string | null, limit = 30) {
  let cursorFilter
  if (cursor) {
    const [ts, id] = cursor.split('_')
    const date = new Date(ts)
    if (!Number.isNaN(date.getTime()) && /^[0-9a-f-]{36}$/.test(id ?? '')) {
      cursorFilter = or(lt(schema.photos.createdAt, date), and(eq(schema.photos.createdAt, date), lt(schema.photos.id, id)))
    }
  }
  const rows = await db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.albumId, albumId), eq(schema.photos.status, 'approved'), cursorFilter))
    .orderBy(desc(schema.photos.createdAt), desc(schema.photos.id))
    .limit(limit + 1)
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    photos: page.map<PublicPhoto>((p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      color: p.dominantColor,
      // Nome de quem enviou só aparece com autorização expressa.
      name: p.showNamePublicly && p.uploaderName ? p.uploaderName : null,
      createdAt: p.createdAt.toISOString(),
    })),
    nextCursor: rows.length > limit && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
  }
}

export async function savePhoto(opts: {
  album: Album
  tokenId: string | null
  invitationId: string | null
  file: Buffer
  originalName: string | null
  uploaderName: string | null
  showNamePublicly: boolean
  source: 'camera' | 'gallery'
  ipHash: string
}) {
  const img = await processImage(opts.file)
  const id = randomUUID()
  const base = `photos/${opts.album.id}/${id}`
  const originalKey = `${base}/original.${img.original.ext}`
  await Promise.all([
    storage().put(originalKey, img.original.data, img.original.mime),
    storage().put(`${base}/web.webp`, img.web, 'image/webp'),
    storage().put(`${base}/thumb.webp`, img.thumb, 'image/webp'),
  ])
  const approved = !opts.album.requireApproval
  const [row] = await db
    .insert(schema.photos)
    .values({
      id,
      albumId: opts.album.id,
      tokenId: opts.tokenId,
      invitationId: opts.invitationId,
      uploaderName: opts.uploaderName,
      showNamePublicly: opts.showNamePublicly && !!opts.uploaderName,
      status: approved ? 'approved' : 'pending',
      source: opts.source,
      originalKey,
      webKey: `${base}/web.webp`,
      thumbKey: `${base}/thumb.webp`,
      originalName: opts.originalName,
      mime: img.original.mime,
      width: img.width,
      height: img.height,
      bytes: opts.file.length,
      dominantColor: img.dominantColor,
      ipHash: opts.ipHash,
      approvedAt: approved ? new Date() : null,
    })
    .returning()
  return row
}

export async function getPhoto(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [row] = await db
    .select({ photo: schema.photos, publicGallery: schema.albums.publicGalleryEnabled })
    .from(schema.photos)
    .innerJoin(schema.albums, eq(schema.albums.id, schema.photos.albumId))
    .where(eq(schema.photos.id, id))
  return row ?? null
}

export function photoDownloadName(p: Pick<Photo, 'id' | 'createdAt' | 'originalKey'>) {
  const ext = p.originalKey.split('.').pop() ?? 'jpg'
  const d = p.createdAt.toISOString().slice(0, 16).replace(/[-:T]/g, '')
  return `noivado-${d}-${p.id.slice(0, 8)}.${ext}`
}
