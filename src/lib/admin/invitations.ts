import 'server-only'
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { greetingFor, invitationUrl } from '@/lib/invitations'
import { invitationFilterSql } from './invitation-filters'
import { getSettings } from '@/lib/settings'
import { eventTemplateValues } from '@/lib/templates'
import type { WaInvitation, WaTemplate } from '@/components/admin/WhatsAppDialog'

export async function loadInvitationRows(opts: { filter?: string; q?: string; archived?: boolean } = {}) {
  const i = schema.invitations
  const conditions = [opts.archived ? isNotNull(i.archivedAt) : isNull(i.archivedAt), invitationFilterSql(opts.filter ?? 'todos')]
  const q = opts.q?.trim()
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`
    const digits = q.replace(/\D/g, '')
    conditions.push(
      or(
        ilike(i.label, like),
        ilike(i.greetingName, like),
        sql`exists (select 1 from guests g where g.invitation_id = ${i.id} and g.removed_at is null and (g.first_name || ' ' || coalesce(g.last_name,'')) ilike ${like})`,
        ...(digits.length >= 4 ? [ilike(i.phone, `%${digits}%`)] : []),
      ),
    )
  }
  const invitations = await db
    .select({ inv: i, groupName: schema.guestGroups.name })
    .from(i)
    .leftJoin(schema.guestGroups, eq(schema.guestGroups.id, i.groupId))
    .where(and(...conditions))
    .orderBy(asc(i.label))
  const ids = invitations.map((r) => r.inv.id)
  if (!ids.length) return []
  const [guests, tokens, gifts] = await Promise.all([
    db
      .select()
      .from(schema.guests)
      .where(and(inArray(schema.guests.invitationId, ids), isNull(schema.guests.removedAt)))
      .orderBy(asc(schema.guests.isCompanion), asc(schema.guests.sortOrder)),
    db
      .select()
      .from(schema.invitationTokens)
      .where(and(inArray(schema.invitationTokens.invitationId, ids), isNull(schema.invitationTokens.revokedAt)))
      .orderBy(desc(schema.invitationTokens.createdAt)),
    db
      .select()
      .from(schema.giftPayments)
      .where(and(inArray(schema.giftPayments.invitationId, ids), eq(schema.giftPayments.status, 'approved'))),
  ])
  return invitations.map(({ inv, groupName }) => {
    const g = guests.filter((x) => x.invitationId === inv.id)
    const token = tokens.find((t) => t.invitationId === inv.id)?.token ?? null
    const paid = gifts.filter((p) => p.invitationId === inv.id)
    return {
      inv,
      groupName,
      guests: g,
      token,
      link: token ? invitationUrl(token) : '',
      greeting: greetingFor(inv, g),
      confirmed: g.filter((x) => x.attendance === 'yes').length,
      invitedCount: g.filter((x) => !x.isCompanion).length,
      gifts: paid.map((p) => ({ name: p.giftName, amountCents: p.amountCents })),
    }
  })
}

export type InvitationRow = Awaited<ReturnType<typeof loadInvitationRows>>[number]

export function toWaInvitation(r: InvitationRow): WaInvitation {
  return {
    id: r.inv.id,
    label: r.inv.label,
    greeting: r.greeting,
    phone: r.inv.phone,
    link: r.link,
    kind: r.inv.kind,
    isCloseFamily: r.inv.isCloseFamily,
    whatsappTemplateId: r.inv.whatsappTemplateId,
    sent: !!r.inv.sentAt,
  }
}

export async function whatsappContext(): Promise<{ templates: WaTemplate[]; eventValues: ReturnType<typeof eventTemplateValues> }> {
  const [templates, settings] = await Promise.all([
    db.select().from(schema.whatsappTemplates).orderBy(asc(schema.whatsappTemplates.kind), asc(schema.whatsappTemplates.name)),
    getSettings(),
  ])
  return {
    templates: templates.map((t) => ({ id: t.id, name: t.name, kind: t.kind, body: t.body, isDefault: t.isDefault })),
    eventValues: eventTemplateValues(settings),
  }
}
