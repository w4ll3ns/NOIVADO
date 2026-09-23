import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { cleanLine, cleanText } from '@/lib/sanitize'
import { logInvitationEvent } from '@/lib/invitations'
import type { RsvpStatus } from '@/lib/db/schema'

export type RsvpInput = {
  attendance: Record<string, 'yes' | 'no'>
  companions: string[]
  dietaryRestrictions: string
  specialNeeds: string
  notes: string
  songRequest: string
  messageToCouple: string
}

export class RsvpError extends Error {}

export function parseRsvpForm(form: FormData, guestIds: string[], maxCompanions: number): RsvpInput {
  const attendance: Record<string, 'yes' | 'no'> = {}
  for (const id of guestIds) {
    const v = form.get(`att_${id}`)
    if (v === 'yes' || v === 'no') attendance[id] = v
  }
  const companions = form
    .getAll('companion')
    .map((v) => cleanLine(v, 80))
    .filter((v) => v.length >= 2)
    .slice(0, Math.max(0, maxCompanions))
  return {
    attendance,
    companions,
    dietaryRestrictions: cleanText(form.get('dietary'), 500),
    specialNeeds: cleanText(form.get('specialNeeds'), 500),
    notes: cleanText(form.get('notes'), 1000),
    songRequest: cleanLine(form.get('song'), 160),
    messageToCouple: cleanText(form.get('message'), 2000),
  }
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/)
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || null }
}

/**
 * Grava uma resposta de presença. Cada envio cria um novo registro em `rsvps`
 * (+ `rsvp_guests`) — o histórico anterior nunca é apagado.
 */
export async function submitRsvp(invitationId: string, input: RsvpInput) {
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(schema.invitations).where(eq(schema.invitations.id, invitationId)).for('update')
    if (!inv) throw new RsvpError('Convite não encontrado.')
    const all = await tx
      .select()
      .from(schema.guests)
      .where(and(eq(schema.guests.invitationId, invitationId), isNull(schema.guests.removedAt)))
    const main = all.filter((g) => !g.isCompanion).sort((a, b) => a.sortOrder - b.sortOrder)
    const oldCompanions = all.filter((g) => g.isCompanion).sort((a, b) => a.sortOrder - b.sortOrder)

    for (const g of main) {
      if (!input.attendance[g.id]) throw new RsvpError(`Conte para nós se ${g.firstName} poderá comparecer.`)
    }
    const anyYes = main.some((g) => input.attendance[g.id] === 'yes')
    const companions = inv.allowCompanions && anyYes ? input.companions.slice(0, inv.maxCompanions) : []

    const now = new Date()
    for (const g of main) {
      await tx
        .update(schema.guests)
        .set({ attendance: input.attendance[g.id], updatedAt: now })
        .where(eq(schema.guests.id, g.id))
    }

    // Acompanhantes: atualiza por posição, cria novos, remove (logicamente) os que saíram.
    const companionRows: { id: string; name: string }[] = []
    for (let i = 0; i < Math.max(companions.length, oldCompanions.length); i++) {
      const name = companions[i]
      const existing = oldCompanions[i]
      if (name && existing) {
        await tx
          .update(schema.guests)
          .set({ ...splitName(name), attendance: 'yes', updatedAt: now })
          .where(eq(schema.guests.id, existing.id))
        companionRows.push({ id: existing.id, name })
      } else if (name) {
        const [row] = await tx
          .insert(schema.guests)
          .values({ invitationId, ...splitName(name), isCompanion: true, attendance: 'yes', sortOrder: 100 + i })
          .returning({ id: schema.guests.id })
        companionRows.push({ id: row.id, name })
      } else if (existing) {
        await tx.update(schema.guests).set({ removedAt: now, attendance: 'no', updatedAt: now }).where(eq(schema.guests.id, existing.id))
      }
    }

    const attendingCount = main.filter((g) => input.attendance[g.id] === 'yes').length + companionRows.length
    const declinedCount = main.filter((g) => input.attendance[g.id] === 'no').length
    const status: RsvpStatus = attendingCount > 0 ? 'attending' : 'declined'
    const isChange = !!inv.rsvpRespondedAt

    const [rsvp] = await tx
      .insert(schema.rsvps)
      .values({
        invitationId,
        status,
        attendingCount,
        declinedCount,
        dietaryRestrictions: input.dietaryRestrictions || null,
        specialNeeds: input.specialNeeds || null,
        notes: input.notes || null,
        songRequest: input.songRequest || null,
        messageToCouple: input.messageToCouple || null,
        isChange,
      })
      .returning()

    await tx.insert(schema.rsvpGuests).values([
      ...main.map((g) => ({
        rsvpId: rsvp.id,
        guestId: g.id,
        guestName: [g.firstName, g.lastName].filter(Boolean).join(' '),
        isCompanion: false,
        attending: input.attendance[g.id] === 'yes',
      })),
      ...companionRows.map((c) => ({ rsvpId: rsvp.id, guestId: c.id, guestName: c.name, isCompanion: true, attending: true })),
    ])

    await tx
      .update(schema.invitations)
      .set({ rsvpStatus: status, rsvpRespondedAt: now, updatedAt: now })
      .where(eq(schema.invitations.id, invitationId))

    await logInvitationEvent(
      invitationId,
      isChange ? 'rsvp_changed' : 'rsvp_submitted',
      { data: { status, attendingCount, declinedCount, previousStatus: inv.rsvpStatus } },
      tx,
    )

    // A mensagem aos noivos vira um registro em "Mensagens" (somente quando é nova).
    const [lastMessage] = isChange
      ? await tx
          .select({ content: schema.messages.content })
          .from(schema.messages)
          .where(and(eq(schema.messages.invitationId, invitationId), eq(schema.messages.source, 'rsvp')))
          .orderBy(desc(schema.messages.createdAt))
          .limit(1)
      : []
    if (input.messageToCouple && input.messageToCouple !== lastMessage?.content) {
      const author = main.map((g) => g.firstName).join(', ') || inv.label
      await tx.insert(schema.messages).values({
        invitationId,
        source: 'rsvp',
        authorName: author,
        content: input.messageToCouple,
        rsvpId: rsvp.id,
      })
      await logInvitationEvent(invitationId, 'message_sent', { data: { source: 'rsvp' } }, tx)
    }

    return { status, attendingCount, declinedCount, isChange }
  })
}
