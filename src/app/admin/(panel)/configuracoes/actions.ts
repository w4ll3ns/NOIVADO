'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { getSettings, saveSetting } from '@/lib/settings'
import { settingsSchemas, type SettingsKey } from '@/lib/settings-schema'
import { cleanLine, cleanText } from '@/lib/sanitize'

export type SettingsState = { ok?: boolean; error?: string }

function baseType(field: z.ZodType): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let def: any = (field as any)._zod.def
  while (['default', 'prefault', 'optional', 'nullable', 'pipe', 'catch'].includes(def.type)) {
    def = (def.innerType ?? def.in)._zod.def
  }
  return def.type
}

export async function saveSettingsAction(key: SettingsKey, _prev: SettingsState, form: FormData): Promise<SettingsState> {
  const admin = await requireAdmin('editor')
  const shape = settingsSchemas[key].shape as Record<string, z.ZodType>
  // Mescla com o valor atual: só os campos exibidos neste formulário são alterados.
  const value: Record<string, unknown> = { ...((await getSettings())[key] as Record<string, unknown>) }
  const rendered = new Set(String(form.get('__fields') ?? '').split(','))
  for (const [name, field] of Object.entries(shape)) {
    if (!rendered.has(name)) continue
    const type = baseType(field)
    if (type === 'boolean') value[name] = form.get(name) === 'on'
    else if (type === 'number') value[name] = Number(form.get(name) ?? 0)
    else if (type === 'array') {
      try {
        value[name] = JSON.parse(String(form.get(name) ?? '[]'))
      } catch {
        return { error: `Lista inválida em ${name}.` }
      }
    } else if (form.has(name)) value[name] = String(form.get(name) ?? '').replace(/\r\n?/g, '\n')
  }
  const parsed = settingsSchemas[key].safeParse(value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: `Confira o campo “${issue.path.join('.')}”: ${issue.message}` }
  }
  await saveSetting(key, parsed.data, admin.id)
  await audit(admin.id, `settings.${key}`, 'site_settings', key)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveMilestoneAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id') ?? '')
  const title = cleanLine(form.get('title'), 160)
  if (!title) return
  const mediaId = String(form.get('mediaId') ?? '')
  const values = {
    title,
    dateLabel: cleanLine(form.get('dateLabel'), 60) || null,
    text: cleanText(form.get('text'), 1200) || null,
    mediaId: /^[0-9a-f-]{36}$/.test(mediaId) ? mediaId : null,
    sortOrder: Number(form.get('sortOrder') ?? 0) || 0,
    isActive: form.get('isActive') === 'on',
    updatedAt: new Date(),
  }
  if (form.get('op') === 'delete' && /^[0-9a-f-]{36}$/.test(id)) await db.delete(schema.storyMilestones).where(eq(schema.storyMilestones.id, id))
  else if (/^[0-9a-f-]{36}$/.test(id)) await db.update(schema.storyMilestones).set(values).where(eq(schema.storyMilestones.id, id))
  else await db.insert(schema.storyMilestones).values(values)
  await audit(admin.id, 'story.save', 'story_milestone', id || null)
  revalidatePath('/admin/configuracoes/historia')
  revalidatePath('/')
}

export async function saveScheduleAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id') ?? '')
  const title = cleanLine(form.get('title'), 160)
  const timeLabel = cleanLine(form.get('timeLabel'), 20)
  if (form.get('op') === 'delete' && /^[0-9a-f-]{36}$/.test(id)) {
    await db.delete(schema.scheduleItems).where(eq(schema.scheduleItems.id, id))
  } else if (title && timeLabel) {
    const values = {
      title,
      timeLabel,
      description: cleanText(form.get('description'), 400) || null,
      sortOrder: Number(form.get('sortOrder') ?? 0) || 0,
      isActive: form.get('isActive') === 'on',
      updatedAt: new Date(),
    }
    if (/^[0-9a-f-]{36}$/.test(id)) await db.update(schema.scheduleItems).set(values).where(eq(schema.scheduleItems.id, id))
    else await db.insert(schema.scheduleItems).values(values)
  }
  await audit(admin.id, 'schedule.save', 'schedule_item', id || null)
  revalidatePath('/admin/configuracoes/programacao')
  revalidatePath('/')
}
