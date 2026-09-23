import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, schema, type Tx } from '@/lib/db'
import { isValidTokenShape, randomToken } from '@/lib/security/tokens'
import { joinNames } from '@/lib/format'
import { env } from '@/lib/env'
import type { InvitationEventType } from '@/lib/db/schema'

export const GUEST_COOKIE = 'mc_guest'
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 240

export type Invitation = typeof schema.invitations.$inferSelect
export type Guest = typeof schema.guests.$inferSelect

export function invitationUrl(token: string) {
  return `${env.appUrl}/i/${token}`
}

/** "João e Maria" — como o convite é saudado. */
export function greetingFor(inv: Pick<Invitation, 'greetingName' | 'label'>, guests: Pick<Guest, 'firstName' | 'isCompanion'>[]) {
  if (inv.greetingName?.trim()) return inv.greetingName.trim()
  const names = guests.filter((g) => !g.isCompanion).map((g) => g.firstName)
  return names.length ? joinNames(names) : inv.label
}

export async function findInvitationByToken(token: string) {
  if (!isValidTokenShape(token, 8, 40)) return null
  const [row] = await db
    .select({ invitation: schema.invitations, tokenId: schema.invitationTokens.id })
    .from(schema.invitationTokens)
    .innerJoin(schema.invitations, eq(schema.invitationTokens.invitationId, schema.invitations.id))
    .where(
      and(
        eq(schema.invitationTokens.token, token),
        isNull(schema.invitationTokens.revokedAt),
        isNull(schema.invitations.archivedAt),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function activeTokenFor(invitationId: string): Promise<string | null> {
  const [row] = await db
    .select({ token: schema.invitationTokens.token })
    .from(schema.invitationTokens)
    .where(and(eq(schema.invitationTokens.invitationId, invitationId), isNull(schema.invitationTokens.revokedAt)))
    .orderBy(desc(schema.invitationTokens.createdAt))
    .limit(1)
  return row?.token ?? null
}

export async function createInvitationToken(invitationId: string, tx: Tx | typeof db = db) {
  // Colisão é astronomicamente improvável, mas a unicidade é garantida pelo índice.
  for (let i = 0; i < 5; i++) {
    const token = randomToken(12)
    try {
      await tx.insert(schema.invitationTokens).values({ invitationId, token })
      return token
    } catch (err) {
      if (i === 4) throw err
    }
  }
  throw new Error('Não foi possível gerar o link do convite')
}

export async function listGuests(invitationId: string) {
  return db
    .select()
    .from(schema.guests)
    .where(and(eq(schema.guests.invitationId, invitationId), isNull(schema.guests.removedAt)))
    .orderBy(asc(schema.guests.isCompanion), asc(schema.guests.sortOrder), asc(schema.guests.createdAt))
}

export async function logInvitationEvent(
  invitationId: string,
  type: InvitationEventType,
  opts: { actor?: 'guest' | 'admin' | 'system'; adminId?: string | null; data?: Record<string, unknown> } = {},
  tx: Tx | typeof db = db,
) {
  await tx.insert(schema.invitationEvents).values({
    invitationId,
    type,
    actor: opts.actor ?? 'guest',
    adminId: opts.adminId ?? null,
    data: opts.data ?? null,
  })
}

/** Registra eventos "de visualização" no máximo uma vez a cada 6 horas (somente o relevante). */
export async function logInvitationEventThrottled(invitationId: string, type: InvitationEventType, hours = 6) {
  const [recent] = await db
    .select({ id: schema.invitationEvents.id })
    .from(schema.invitationEvents)
    .where(
      and(
        eq(schema.invitationEvents.invitationId, invitationId),
        eq(schema.invitationEvents.type, type),
        sql`${schema.invitationEvents.createdAt} > now() - make_interval(hours => ${hours})`,
      ),
    )
    .limit(1)
  if (!recent) await logInvitationEvent(invitationId, type)
}

/**
 * Acesso ao link (chamado pelo beacon no navegador — robôs de prévia não executam JS).
 * Guarda primeiro/último acesso e contagem; registra "link acessado" apenas na 1ª vez
 * e "link acessado novamente" após 6h sem acessos.
 */
export async function recordInvitationAccess(invitationId: string) {
  const [before] = await db
    .select({ first: schema.invitations.firstAccessedAt, last: schema.invitations.lastAccessedAt })
    .from(schema.invitations)
    .where(eq(schema.invitations.id, invitationId))
  if (!before) return
  const now = new Date()
  await db
    .update(schema.invitations)
    .set({
      firstAccessedAt: before.first ?? now,
      lastAccessedAt: now,
      accessCount: sql`${schema.invitations.accessCount} + 1`,
    })
    .where(eq(schema.invitations.id, invitationId))
  if (!before.first) {
    await logInvitationEvent(invitationId, 'link_accessed')
  } else if (!before.last || now.getTime() - before.last.getTime() > 6 * 3600_000) {
    await logInvitationEvent(invitationId, 'link_revisited')
  }
}

export async function setGuestCookie(token: string) {
  const jar = await cookies()
  jar.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE,
  })
}

export type CurrentGuest = {
  token: string
  invitation: Invitation
  guests: Guest[]
  greeting: string
}

/** Convite reconhecido pelo cookie (definido quando o link pessoal é aberto). */
export const getCurrentGuest = cache(async (): Promise<CurrentGuest | null> => {
  const jar = await cookies()
  const token = jar.get(GUEST_COOKIE)?.value
  if (!token) return null
  const found = await findInvitationByToken(token)
  if (!found) return null
  const guests = await listGuests(found.invitation.id)
  return { token, invitation: found.invitation, guests, greeting: greetingFor(found.invitation, guests) }
})

export async function loadInvitationGifts(invitationId: string) {
  return db
    .select({
      id: schema.giftPayments.id,
      giftName: schema.giftPayments.giftName,
      giftId: schema.giftPayments.giftId,
      icon: schema.gifts.icon,
      amountCents: schema.giftPayments.amountCents,
      status: schema.giftPayments.status,
      message: schema.giftPayments.message,
      approvedAt: schema.giftPayments.approvedAt,
      createdAt: schema.giftPayments.createdAt,
    })
    .from(schema.giftPayments)
    .innerJoin(schema.gifts, eq(schema.gifts.id, schema.giftPayments.giftId))
    .where(
      and(
        eq(schema.giftPayments.invitationId, invitationId),
        inArray(schema.giftPayments.status, ['approved', 'awaiting']),
      ),
    )
    .orderBy(desc(schema.giftPayments.createdAt))
}

export async function loadInvitationMessages(invitationId: string) {
  return db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.invitationId, invitationId), isNull(schema.messages.archivedAt)))
    .orderBy(desc(schema.messages.createdAt))
    .limit(5)
}

export async function latestRsvp(invitationId: string) {
  const [row] = await db
    .select()
    .from(schema.rsvps)
    .where(eq(schema.rsvps.invitationId, invitationId))
    .orderBy(desc(schema.rsvps.createdAt))
    .limit(1)
  return row ?? null
}
