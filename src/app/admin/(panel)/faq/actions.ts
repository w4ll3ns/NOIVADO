'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { cleanLine, cleanText } from '@/lib/sanitize'

export async function saveFaqAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id') ?? '')
  const question = cleanLine(form.get('question'), 200)
  const answer = cleanText(form.get('answer'), 3000)
  if (!question || !answer) return
  const values = { question, answer, sortOrder: Number(form.get('sortOrder') ?? 0) || 0, isActive: form.get('isActive') === 'on', updatedAt: new Date() }
  if (/^[0-9a-f-]{36}$/.test(id)) await db.update(schema.faqs).set(values).where(eq(schema.faqs.id, id))
  else await db.insert(schema.faqs).values(values)
  await audit(admin.id, 'faq.save', 'faq', id || null)
  revalidatePath('/admin/faq')
  revalidatePath('/')
}

export async function deleteFaqAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id'))
  if (!/^[0-9a-f-]{36}$/.test(id)) return
  await db.delete(schema.faqs).where(eq(schema.faqs.id, id))
  await audit(admin.id, 'faq.delete', 'faq', id)
  revalidatePath('/admin/faq')
  revalidatePath('/')
}
