'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { createInvitationToken, logInvitationEvent } from '@/lib/invitations'
import { normalizePhone } from '@/lib/format'
import { cleanLine, cleanText, isEmail } from '@/lib/sanitize'
import { INVITATION_KINDS, type RsvpStatus } from '@/lib/db/schema'

/* ---------------- WhatsApp / envio ---------------- */

export async function whatsappOpenedAction(invitationId: string, mode: 'invite' | 'reminder', templateName: string) {
  const admin = await requireAdmin('editor')
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.id, invitationId))
  if (!inv) return
  await logInvitationEvent(invitationId, mode === 'reminder' ? 'reminder_prepared' : 'whatsapp_prepared', {
    actor: 'admin',
    adminId: admin.id,
    data: { template: templateName.slice(0, 80) },
  })
  if (!inv.sentAt) {
    await db.update(schema.invitations).set({ sentAt: new Date(), sentVia: 'whatsapp', updatedAt: new Date() }).where(eq(schema.invitations.id, invitationId))
    await logInvitationEvent(invitationId, 'marked_sent', { actor: 'admin', adminId: admin.id })
  }
  revalidatePath('/admin/convites')
}

export async function markSentAction(invitationId: string) {
  const admin = await requireAdmin('editor')
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.id, invitationId))
  if (!inv || inv.sentAt) return
  await db.update(schema.invitations).set({ sentAt: new Date(), sentVia: 'manual', updatedAt: new Date() }).where(eq(schema.invitations.id, invitationId))
  await logInvitationEvent(invitationId, 'marked_sent', { actor: 'admin', adminId: admin.id })
  revalidatePath('/admin/convites')
}

export async function unmarkSentAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id'))
  await db.update(schema.invitations).set({ sentAt: null, sentVia: null, updatedAt: new Date() }).where(eq(schema.invitations.id, id))
  await logInvitationEvent(id, 'unmarked_sent', { actor: 'admin', adminId: admin.id })
  await audit(admin.id, 'invitation.unmark_sent', 'invitation', id)
  revalidatePath(`/admin/convites/${id}`)
}

export async function markSentFormAction(form: FormData) {
  await markSentAction(String(form.get('id')))
  revalidatePath(`/admin/convites/${String(form.get('id'))}`)
}

/* ---------------- Link ---------------- */

export async function regenerateTokenAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id'))
  await db.transaction(async (tx) => {
    await tx
      .update(schema.invitationTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invitationTokens.invitationId, id), isNull(schema.invitationTokens.revokedAt)))
    await createInvitationToken(id, tx)
    await logInvitationEvent(id, 'token_regenerated', { actor: 'admin', adminId: admin.id }, tx)
  })
  await audit(admin.id, 'invitation.regenerate_link', 'invitation', id)
  revalidatePath(`/admin/convites/${id}`)
}

export async function archiveInvitationAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id'))
  const restore = form.get('restore') === '1'
  await db.update(schema.invitations).set({ archivedAt: restore ? null : new Date(), updatedAt: new Date() }).where(eq(schema.invitations.id, id))
  await audit(admin.id, restore ? 'invitation.restore' : 'invitation.archive', 'invitation', id)
  revalidatePath('/admin/convites')
  if (!restore) redirect('/admin/convites')
  revalidatePath(`/admin/convites/${id}`)
}

/* ---------------- Criar / editar ---------------- */

const guestSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  firstName: z.string(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  isChild: z.boolean().optional(),
  isCompanion: z.boolean().optional(),
  attendance: z.enum(['pending', 'yes', 'no']).optional(),
})

export type InvitationFormState = { error?: string; ok?: boolean }

export async function saveInvitationAction(invitationId: string | null, _prev: InvitationFormState, form: FormData): Promise<InvitationFormState> {
  const admin = await requireAdmin('editor')
  const label = cleanLine(form.get('label'), 120)
  const kind = String(form.get('kind'))
  const phoneRaw = cleanLine(form.get('phone'), 40)
  const email = cleanLine(form.get('email'), 200).toLowerCase()
  const allowCompanions = form.get('allowCompanions') === 'on'
  const maxCompanions = allowCompanions ? Math.max(0, Math.min(10, Number(form.get('maxCompanions') ?? 0) || 0)) : 0
  const groupName = cleanLine(form.get('groupName'), 80)
  const templateId = String(form.get('whatsappTemplateId') ?? '')
  let guestsInput: z.infer<typeof guestSchema>[]
  try {
    guestsInput = z.array(guestSchema).max(40).parse(JSON.parse(String(form.get('guests') ?? '[]')))
  } catch {
    return { error: 'Lista de convidados inválida.' }
  }
  const guests = guestsInput
    .map((g) => ({
      ...g,
      firstName: cleanLine(g.firstName, 60),
      lastName: cleanLine(g.lastName ?? '', 80) || null,
      phone: g.phone ? normalizePhone(g.phone) : null,
      email: cleanLine(g.email ?? '', 200).toLowerCase() || null,
    }))
    .filter((g) => g.firstName)

  if (!label) return { error: 'Dê um nome ao convite (ex.: Família Silva).' }
  if (!(INVITATION_KINDS as readonly string[]).includes(kind)) return { error: 'Tipo de convite inválido.' }
  if (!guests.filter((g) => !g.isCompanion).length) return { error: 'Inclua pelo menos uma pessoa no convite.' }
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null
  if (phoneRaw && !phone) return { error: 'Telefone inválido. Use DDD + número (ex.: 98 99999-9999).' }
  if (email && !isEmail(email)) return { error: 'E-mail inválido.' }

  const id = await db.transaction(async (tx) => {
    let groupId: string | null = null
    if (groupName) {
      const [existing] = await tx.select().from(schema.guestGroups).where(eq(schema.guestGroups.name, groupName))
      groupId = existing?.id ?? (await tx.insert(schema.guestGroups).values({ name: groupName }).returning())[0].id
    }
    const values = {
      label,
      greetingName: cleanLine(form.get('greetingName'), 120) || null,
      kind: kind as (typeof INVITATION_KINDS)[number],
      groupId,
      isCloseFamily: form.get('isCloseFamily') === 'on',
      phone,
      email: email || null,
      allowCompanions,
      maxCompanions,
      whatsappTemplateId: /^[0-9a-f-]{36}$/.test(templateId) ? templateId : null,
      notes: cleanText(form.get('notes'), 2000) || null,
      updatedAt: new Date(),
    }
    let invId = invitationId
    if (invId) {
      await tx.update(schema.invitations).set(values).where(eq(schema.invitations.id, invId))
    } else {
      invId = (await tx.insert(schema.invitations).values(values).returning())[0].id
      await createInvitationToken(invId, tx)
      await logInvitationEvent(invId, 'created', { actor: 'admin', adminId: admin.id }, tx)
    }

    const current = await tx
      .select()
      .from(schema.guests)
      .where(and(eq(schema.guests.invitationId, invId), isNull(schema.guests.removedAt)))
    const keep = new Set<string>()
    let attendanceChanged = false
    for (const [index, g] of guests.entries()) {
      const existing = g.id ? current.find((c) => c.id === g.id) : undefined
      const attendance = g.attendance ?? existing?.attendance ?? 'pending'
      if (existing) {
        keep.add(existing.id)
        if (existing.attendance !== attendance) attendanceChanged = true
        await tx
          .update(schema.guests)
          .set({
            firstName: g.firstName,
            lastName: g.lastName,
            phone: g.phone,
            email: g.email,
            isChild: !!g.isChild,
            attendance,
            sortOrder: existing.isCompanion ? existing.sortOrder : index,
            updatedAt: new Date(),
          })
          .where(eq(schema.guests.id, existing.id))
      } else {
        if (attendance !== 'pending') attendanceChanged = true
        const [row] = await tx
          .insert(schema.guests)
          .values({ invitationId: invId, firstName: g.firstName, lastName: g.lastName, phone: g.phone, email: g.email, isChild: !!g.isChild, isCompanion: !!g.isCompanion, attendance, sortOrder: index })
          .returning({ id: schema.guests.id })
        keep.add(row.id)
      }
    }
    for (const c of current) {
      if (!keep.has(c.id)) {
        await tx.update(schema.guests).set({ removedAt: new Date(), updatedAt: new Date() }).where(eq(schema.guests.id, c.id))
        if (c.attendance !== 'pending') attendanceChanged = true
      }
    }

    // Resposta registrada manualmente pelo painel (ex.: convidado respondeu por telefone) — entra no histórico.
    if (attendanceChanged && invitationId) {
      const final = await tx
        .select()
        .from(schema.guests)
        .where(and(eq(schema.guests.invitationId, invId), isNull(schema.guests.removedAt)))
      const yes = final.filter((g) => g.attendance === 'yes').length
      const no = final.filter((g) => g.attendance === 'no').length
      const status: RsvpStatus = yes > 0 ? 'attending' : no > 0 && final.every((g) => g.attendance !== 'pending') ? 'declined' : 'pending'
      const [inv] = await tx.select().from(schema.invitations).where(eq(schema.invitations.id, invId))
      if (status !== 'pending') {
        const [rsvp] = await tx
          .insert(schema.rsvps)
          .values({ invitationId: invId, status, attendingCount: yes, declinedCount: no, isChange: !!inv.rsvpRespondedAt, notes: 'Registrado manualmente pelo painel' })
          .returning()
        await tx.insert(schema.rsvpGuests).values(
          final
            .filter((g) => g.attendance !== 'pending')
            .map((g) => ({ rsvpId: rsvp.id, guestId: g.id, guestName: [g.firstName, g.lastName].filter(Boolean).join(' '), isCompanion: g.isCompanion, attending: g.attendance === 'yes' })),
        )
      }
      await tx.update(schema.invitations).set({ rsvpStatus: status, rsvpRespondedAt: status === 'pending' ? inv.rsvpRespondedAt : new Date() }).where(eq(schema.invitations.id, invId))
      await logInvitationEvent(invId, 'rsvp_changed', { actor: 'admin', adminId: admin.id, data: { status, attendingCount: yes, declinedCount: no, manual: true } }, tx)
    }
    return invId
  })

  await audit(admin.id, invitationId ? 'invitation.update' : 'invitation.create', 'invitation', id, { label })
  revalidatePath('/admin/convites')
  redirect(`/admin/convites/${id}?salvo=1`)
}
