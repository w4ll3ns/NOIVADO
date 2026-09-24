'use server'

import { revalidatePath } from 'next/cache'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { PHOTO_STATUSES, type PhotoStatus } from '@/lib/db/schema'

export async function moderatePhotosAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const to = String(form.get('to'))
  if (!(PHOTO_STATUSES as readonly string[]).includes(to)) return
  const ids = String(form.get('ids') ?? '')
    .split(',')
    .filter((id) => /^[0-9a-f-]{36}$/.test(id))
    .slice(0, 500)
  if (!ids.length) return
  await db.transaction(async (tx) => {
    const current = await tx.select({ id: schema.photos.id, status: schema.photos.status }).from(schema.photos).where(inArray(schema.photos.id, ids))
    const changed = current.filter((p) => p.status !== to)
    if (!changed.length) return
    await tx
      .update(schema.photos)
      .set({ status: to as PhotoStatus, ...(to === 'approved' ? { approvedAt: new Date() } : {}) })
      .where(inArray(schema.photos.id, changed.map((p) => p.id)))
    await tx.insert(schema.photoModeration).values(changed.map((p) => ({ photoId: p.id, adminId: admin.id, fromStatus: p.status, toStatus: to as PhotoStatus })))
  })
  await audit(admin.id, `photo.${to}`, 'photo', ids.length === 1 ? ids[0] : null, { count: ids.length })
  revalidatePath('/admin/fotos')
  revalidatePath('/galeria')
}

export async function photoNameVisibilityAction(form: FormData) {
  await requireAdmin('editor')
  const id = String(form.get('id'))
  const [p] = await db.select().from(schema.photos).where(eq(schema.photos.id, id))
  if (!p) return
  await db.update(schema.photos).set({ showNamePublicly: !p.showNamePublicly }).where(eq(schema.photos.id, id))
  revalidatePath('/admin/fotos')
}
