'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { cleanLine, cleanText } from '@/lib/sanitize'
import { WHATSAPP_TEMPLATE_KINDS, type WhatsappTemplateKind } from '@/lib/db/schema'

export async function saveTemplateAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id') ?? '')
  const name = cleanLine(form.get('name'), 80)
  const body = cleanText(form.get('body'), 4000)
  const kindRaw = String(form.get('kind'))
  const kind: WhatsappTemplateKind = (WHATSAPP_TEMPLATE_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as WhatsappTemplateKind) : 'custom'
  const isDefault = form.get('isDefault') === 'on'
  if (!name || !body) return
  let templateId = id
  if (/^[0-9a-f-]{36}$/.test(id)) {
    await db.update(schema.whatsappTemplates).set({ name, body, kind, isDefault, updatedAt: new Date() }).where(eq(schema.whatsappTemplates.id, id))
  } else {
    templateId = (await db.insert(schema.whatsappTemplates).values({ name, body, kind, isDefault }).returning())[0].id
  }
  // Um único padrão por tipo.
  if (isDefault) {
    await db
      .update(schema.whatsappTemplates)
      .set({ isDefault: false })
      .where(and(eq(schema.whatsappTemplates.kind, kind), ne(schema.whatsappTemplates.id, templateId)))
  }
  await audit(admin.id, 'whatsapp_template.save', 'whatsapp_template', templateId, { name })
  revalidatePath('/admin/whatsapp')
}

export async function deleteTemplateAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id'))
  if (!/^[0-9a-f-]{36}$/.test(id)) return
  await db.update(schema.invitations).set({ whatsappTemplateId: null }).where(eq(schema.invitations.whatsappTemplateId, id))
  await db.delete(schema.whatsappTemplates).where(eq(schema.whatsappTemplates.id, id))
  await audit(admin.id, 'whatsapp_template.delete', 'whatsapp_template', id)
  revalidatePath('/admin/whatsapp')
}
