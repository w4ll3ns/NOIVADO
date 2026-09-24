import 'server-only'
import { and, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { PAYMENT_STATUSES, type PaymentStatus } from '@/lib/db/schema'

export type PaymentFilters = { status?: string; gift?: string; q?: string; from?: string; to?: string }

export async function listPayments(f: PaymentFilters) {
  const p = schema.giftPayments
  const conds: (SQL | undefined)[] = []
  if (f.status && (PAYMENT_STATUSES as readonly string[]).includes(f.status)) conds.push(eq(p.status, f.status as PaymentStatus))
  if (f.gift && /^[0-9a-f-]{36}$/.test(f.gift)) conds.push(eq(p.giftId, f.gift))
  if (f.q?.trim()) {
    const like = `%${f.q.trim().replace(/[%_]/g, '')}%`
    conds.push(or(ilike(p.payerName, like), ilike(p.payerEmail, like), ilike(schema.invitations.label, like), ilike(p.mpPaymentId, like)))
  }
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) conds.push(gte(p.createdAt, new Date(`${f.from}T00:00:00-03:00`)))
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) conds.push(lte(p.createdAt, new Date(`${f.to}T23:59:59-03:00`)))
  return db
    .select({ p, invitationLabel: schema.invitations.label })
    .from(p)
    .leftJoin(schema.invitations, eq(schema.invitations.id, p.invitationId))
    .where(and(...conds))
    .orderBy(desc(p.createdAt))
    .limit(1000)
}
