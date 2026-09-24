'use server'

import { revalidatePath } from 'next/cache'
import { eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'

export async function messageAction(form: FormData) {
  await requireAdmin('editor')
  const id = String(form.get('id'))
  const op = String(form.get('op'))
  if (op === 'all-read') {
    await db.update(schema.messages).set({ readAt: new Date() }).where(isNull(schema.messages.readAt))
  } else if (/^[0-9a-f-]{36}$/.test(id)) {
    const [m] = await db.select().from(schema.messages).where(eq(schema.messages.id, id))
    if (!m) return
    if (op === 'read') await db.update(schema.messages).set({ readAt: m.readAt ? null : new Date() }).where(eq(schema.messages.id, id))
    if (op === 'fav') await db.update(schema.messages).set({ favorite: !m.favorite }).where(eq(schema.messages.id, id))
    if (op === 'archive') await db.update(schema.messages).set({ archivedAt: m.archivedAt ? null : new Date() }).where(eq(schema.messages.id, id))
  }
  revalidatePath('/admin/mensagens')
}
