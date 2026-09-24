'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { cleanLine } from '@/lib/sanitize'

export async function galleryPhotoAction(form: FormData) {
  await requireAdmin('editor')
  const id = String(form.get('id'))
  const op = String(form.get('op'))
  if (!/^[0-9a-f-]{36}$/.test(id)) return
  if (op === 'delete') await db.delete(schema.galleryPhotos).where(eq(schema.galleryPhotos.id, id))
  else
    await db
      .update(schema.galleryPhotos)
      .set({ caption: cleanLine(form.get('caption'), 200) || null, sortOrder: Number(form.get('sortOrder') ?? 0) || 0, isActive: form.get('isActive') === 'on' })
      .where(eq(schema.galleryPhotos.id, id))
  revalidatePath('/admin/galeria')
  revalidatePath('/galeria')
  revalidatePath('/')
}
