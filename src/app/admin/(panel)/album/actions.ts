'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { randomToken } from '@/lib/security/tokens'
import { cleanLine, cleanText } from '@/lib/sanitize'

export type AlbumFormState = { ok?: boolean; error?: string }

function parseLocal(value: FormDataEntryValue | null): Date | null {
  const s = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null
  // Horário informado no fuso do evento (UTC-3).
  return new Date(`${s}:00-03:00`)
}

export async function saveAlbumAction(albumId: string, _prev: AlbumFormState, form: FormData): Promise<AlbumFormState> {
  const admin = await requireAdmin('editor')
  const status = String(form.get('status'))
  if (!['draft', 'open', 'closed'].includes(status)) return { error: 'Status inválido.' }
  const on = (k: string) => form.get(k) === 'on'
  const startsAt = parseLocal(form.get('startsAt'))
  const endsAt = parseLocal(form.get('endsAt'))
  if (startsAt && endsAt && endsAt < startsAt) return { error: 'A data final precisa ser depois da inicial.' }
  await db
    .update(schema.albums)
    .set({
      name: cleanLine(form.get('name'), 80) || 'Álbum do Noivado',
      description: cleanText(form.get('description'), 400) || null,
      closedMessage: cleanText(form.get('closedMessage'), 400) || null,
      status: status as 'draft' | 'open' | 'closed',
      uploadsEnabled: on('uploadsEnabled'),
      publicGalleryEnabled: on('publicGalleryEnabled'),
      requireApproval: form.get('publish') !== 'auto',
      allowAnonymous: on('allowAnonymous'),
      allowGalleryUpload: on('allowGalleryUpload'),
      allowCamera: on('allowCamera'),
      allowMultiple: on('allowMultiple'),
      startsAt,
      endsAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.albums.id, albumId))
  await audit(admin.id, 'album.update', 'album', albumId)
  revalidatePath('/admin/album')
  return { ok: true }
}

export async function createAlbumTokenAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const albumId = String(form.get('albumId'))
  const label = cleanLine(form.get('label'), 60) || 'Geral'
  if (!/^[0-9a-f-]{36}$/.test(albumId)) return
  const [row] = await db.insert(schema.albumTokens).values({ albumId, label, token: randomToken(10) }).returning()
  await audit(admin.id, 'album_token.create', 'album_token', row.id, { label })
  revalidatePath('/admin/album')
}

export async function revokeAlbumTokenAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id'))
  const restore = form.get('restore') === '1'
  await db.update(schema.albumTokens).set({ revokedAt: restore ? null : new Date() }).where(eq(schema.albumTokens.id, id))
  await audit(admin.id, restore ? 'album_token.restore' : 'album_token.revoke', 'album_token', id)
  revalidatePath('/admin/album')
}
