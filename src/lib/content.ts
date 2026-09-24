import 'server-only'
import { and, asc, count, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function getSchedule() {
  return db
    .select()
    .from(schema.scheduleItems)
    .where(eq(schema.scheduleItems.isActive, true))
    .orderBy(asc(schema.scheduleItems.sortOrder), asc(schema.scheduleItems.createdAt))
}

export async function getFaqs() {
  return db
    .select()
    .from(schema.faqs)
    .where(eq(schema.faqs.isActive, true))
    .orderBy(asc(schema.faqs.sortOrder), asc(schema.faqs.createdAt))
}

export async function getCouplePhotos() {
  return db
    .select({
      id: schema.galleryPhotos.id,
      caption: schema.galleryPhotos.caption,
      mediaId: schema.galleryPhotos.mediaId,
      width: schema.media.width,
      height: schema.media.height,
      color: schema.media.dominantColor,
      alt: schema.media.alt,
    })
    .from(schema.galleryPhotos)
    .innerJoin(schema.media, eq(schema.media.id, schema.galleryPhotos.mediaId))
    .where(eq(schema.galleryPhotos.isActive, true))
    .orderBy(asc(schema.galleryPhotos.sortOrder), asc(schema.galleryPhotos.createdAt))
}

export async function getMainAlbum() {
  const [album] = await db.select().from(schema.albums).orderBy(asc(schema.albums.createdAt)).limit(1)
  return album ?? null
}

export async function countApprovedPhotos(albumId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.photos)
    .where(and(eq(schema.photos.albumId, albumId), eq(schema.photos.status, 'approved')))
  return Number(row?.n ?? 0)
}

export async function getAlbumEntryToken(albumId: string) {
  const [row] = await db
    .select({ token: schema.albumTokens.token })
    .from(schema.albumTokens)
    .where(and(eq(schema.albumTokens.albumId, albumId), isNull(schema.albumTokens.revokedAt)))
    .orderBy(asc(schema.albumTokens.createdAt))
    .limit(1)
  return row?.token ?? null
}
