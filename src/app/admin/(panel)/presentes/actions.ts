'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { parseBRLToCents, slugify } from '@/lib/format'
import { cleanLine, cleanText } from '@/lib/sanitize'
import { saveMedia } from '@/lib/media'
import { ImageError } from '@/lib/images'
import { GIFT_AVAILABILITY, GIFT_PRICE_TYPES } from '@/lib/db/schema'

export type GiftFormState = { error?: string }

export async function saveGiftAction(giftId: string | null, _prev: GiftFormState, form: FormData): Promise<GiftFormState> {
  const admin = await requireAdmin('editor')
  const name = cleanLine(form.get('name'), 160)
  const priceType = String(form.get('priceType'))
  const availability = String(form.get('availability'))
  if (!name) return { error: 'Dê um nome ao presente.' }
  if (!(GIFT_PRICE_TYPES as readonly string[]).includes(priceType)) return { error: 'Tipo de valor inválido.' }
  if (!(GIFT_AVAILABILITY as readonly string[]).includes(availability)) return { error: 'Disponibilidade inválida.' }

  const amountCents = parseBRLToCents(String(form.get('amount') ?? ''))
  const minCents = parseBRLToCents(String(form.get('min') ?? ''))
  const maxCents = parseBRLToCents(String(form.get('max') ?? ''))
  const suggestedCents = parseBRLToCents(String(form.get('suggested') ?? ''))
  const quick = String(form.get('quick') ?? '')
    .split(/[;|\s]+/)
    .map((v) => parseBRLToCents(v))
    .filter((v): v is number => !!v && v > 0)
    .slice(0, 8)
  if (priceType === 'fixed' && (!amountCents || amountCents < 100)) return { error: 'Informe o valor do presente (mínimo R$ 1,00).' }
  if (priceType === 'custom' && minCents && maxCents && maxCents < minCents) return { error: 'O valor máximo precisa ser maior que o mínimo.' }
  const quantity = availability === 'limited' ? Math.max(1, Number(form.get('quantity') ?? 1) || 1) : availability === 'unique' ? 1 : null
  const categoryId = String(form.get('categoryId') ?? '')

  let mediaId: string | null | undefined = undefined
  const file = form.get('image')
  if (file instanceof File && file.size > 0) {
    try {
      mediaId = (await saveMedia(file, name)).id
    } catch (err) {
      return { error: err instanceof ImageError ? err.message : 'Não foi possível salvar a imagem.' }
    }
  } else if (form.get('removeImage') === 'on') {
    mediaId = null
  }

  const values = {
    name,
    description: cleanText(form.get('description'), 600) || null,
    categoryId: /^[0-9a-f-]{36}$/.test(categoryId) ? categoryId : null,
    icon: cleanLine(form.get('icon'), 30) || null,
    priceType: priceType as 'fixed' | 'custom',
    amountCents: priceType === 'fixed' ? amountCents : null,
    minCents: priceType === 'custom' ? minCents : null,
    maxCents: priceType === 'custom' ? maxCents : null,
    suggestedCents: priceType === 'custom' ? suggestedCents : null,
    quickAmountsCents: priceType === 'custom' && quick.length ? quick : null,
    availability: availability as 'unique' | 'limited' | 'unlimited',
    quantity,
    featured: form.get('featured') === 'on',
    isActive: form.get('isActive') === 'on',
    sortOrder: Number(form.get('sortOrder') ?? 0) || 0,
    ...(mediaId !== undefined ? { mediaId } : {}),
    updatedAt: new Date(),
  }
  let id = giftId
  if (id) await db.update(schema.gifts).set(values).where(eq(schema.gifts.id, id))
  else id = (await db.insert(schema.gifts).values(values).returning())[0].id
  await audit(admin.id, giftId ? 'gift.update' : 'gift.create', 'gift', id, { name })
  revalidatePath('/admin/presentes')
  revalidatePath('/presentes')
  redirect('/admin/presentes?salvo=1')
}

export async function toggleGiftAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id'))
  const field = String(form.get('field'))
  const [gift] = await db.select().from(schema.gifts).where(eq(schema.gifts.id, id))
  if (!gift) return
  if (field === 'isActive') await db.update(schema.gifts).set({ isActive: !gift.isActive, updatedAt: new Date() }).where(eq(schema.gifts.id, id))
  if (field === 'featured') await db.update(schema.gifts).set({ featured: !gift.featured, updatedAt: new Date() }).where(eq(schema.gifts.id, id))
  if (field === 'archive') await db.update(schema.gifts).set({ archivedAt: gift.archivedAt ? null : new Date(), isActive: false, updatedAt: new Date() }).where(eq(schema.gifts.id, id))
  await audit(admin.id, `gift.${field}`, 'gift', id)
  revalidatePath('/admin/presentes')
  revalidatePath('/presentes')
}

export async function saveCategoryAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id') ?? '')
  const name = cleanLine(form.get('name'), 120)
  if (!name) return
  const values = {
    name,
    description: cleanText(form.get('description'), 400) || null,
    icon: cleanLine(form.get('icon'), 30) || null,
    sortOrder: Number(form.get('sortOrder') ?? 0) || 0,
    isActive: form.get('isActive') === 'on',
  }
  if (/^[0-9a-f-]{36}$/.test(id)) await db.update(schema.giftCategories).set(values).where(eq(schema.giftCategories.id, id))
  else await db.insert(schema.giftCategories).values({ ...values, slug: `${slugify(name)}-${Date.now().toString(36)}` })
  await audit(admin.id, 'gift_category.save', 'gift_category', id || null, { name })
  revalidatePath('/admin/presentes')
  revalidatePath('/presentes')
}
