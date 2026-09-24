import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function invitationStats() {
  const i = schema.invitations
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      sent: sql<number>`count(*) filter (where ${i.sentAt} is not null)`,
      notSent: sql<number>`count(*) filter (where ${i.sentAt} is null)`,
      accessed: sql<number>`count(*) filter (where ${i.firstAccessedAt} is not null)`,
      sentNotAccessed: sql<number>`count(*) filter (where ${i.sentAt} is not null and ${i.firstAccessedAt} is null)`,
      accessedPending: sql<number>`count(*) filter (where ${i.firstAccessedAt} is not null and ${i.rsvpStatus} = 'pending')`,
      attending: sql<number>`count(*) filter (where ${i.rsvpStatus} = 'attending')`,
      declined: sql<number>`count(*) filter (where ${i.rsvpStatus} = 'declined')`,
      pending: sql<number>`count(*) filter (where ${i.rsvpStatus} = 'pending')`,
    })
    .from(i)
    .where(isNull(i.archivedAt))
  const [people] = await db
    .select({
      invited: sql<number>`count(*) filter (where not ${schema.guests.isCompanion})`,
      confirmed: sql<number>`count(*) filter (where ${schema.guests.attendance} = 'yes')`,
      declined: sql<number>`count(*) filter (where ${schema.guests.attendance} = 'no' and not ${schema.guests.isCompanion})`,
      companions: sql<number>`count(*) filter (where ${schema.guests.isCompanion} and ${schema.guests.attendance} = 'yes')`,
    })
    .from(schema.guests)
    .innerJoin(i, eq(i.id, schema.guests.invitationId))
    .where(and(isNull(i.archivedAt), isNull(schema.guests.removedAt)))
  const n = (v: unknown) => Number(v ?? 0)
  return {
    total: n(row.total),
    sent: n(row.sent),
    notSent: n(row.notSent),
    accessed: n(row.accessed),
    notAccessed: n(row.total) - n(row.accessed),
    sentNotAccessed: n(row.sentNotAccessed),
    accessedPending: n(row.accessedPending),
    attending: n(row.attending),
    declined: n(row.declined),
    pending: n(row.pending),
    peopleInvited: n(people.invited),
    peopleConfirmed: n(people.confirmed),
    peopleDeclined: n(people.declined),
    companions: n(people.companions),
  }
}

export async function giftStats() {
  const p = schema.giftPayments
  const [row] = await db
    .select({
      approvedCount: sql<number>`count(*) filter (where ${p.status} = 'approved')`,
      approvedSum: sql<number>`coalesce(sum(${p.amountCents}) filter (where ${p.status} = 'approved'), 0)`,
      awaiting: sql<number>`count(*) filter (where ${p.status} = 'awaiting')`,
      failed: sql<number>`count(*) filter (where ${p.status} in ('rejected','cancelled','expired'))`,
    })
    .from(p)
  const count = Number(row.approvedCount)
  const sum = Number(row.approvedSum)
  return { approvedCount: count, approvedSum: sum, awaiting: Number(row.awaiting), failed: Number(row.failed), average: count ? Math.round(sum / count) : 0 }
}

export async function photoStats() {
  const p = schema.photos
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where ${p.status} = 'pending')`,
      approved: sql<number>`count(*) filter (where ${p.status} = 'approved')`,
      today: sql<number>`count(*) filter (where (${p.createdAt} at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date)`,
    })
    .from(p)
  return { total: Number(row.total), pending: Number(row.pending), approved: Number(row.approved), today: Number(row.today) }
}

export async function messageStats() {
  const [row] = await db
    .select({ total: sql<number>`count(*)`, unread: sql<number>`count(*) filter (where ${schema.messages.readAt} is null)` })
    .from(schema.messages)
    .where(isNull(schema.messages.archivedAt))
  return { total: Number(row.total), unread: Number(row.unread) }
}
