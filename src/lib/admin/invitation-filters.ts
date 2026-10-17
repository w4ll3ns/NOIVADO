import { and, eq, isNotNull, isNull, not, sql, type SQL } from 'drizzle-orm'
import { schema } from '@/lib/db'
import { INVITATION_KINDS } from '@/lib/db/schema'

export const INVITATION_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'nao-enviados', label: 'Não enviados' },
  { key: 'enviados', label: 'Enviados' },
  { key: 'nao-acessados', label: 'Enviados e não acessados' },
  { key: 'acessaram-nao-confirmaram', label: 'Acessaram e não confirmaram' },
  { key: 'confirmados', label: 'Confirmados' },
  { key: 'nao-comparecerao', label: 'Não comparecerão' },
  { key: 'pendentes', label: 'RSVP pendente' },
] as const

export type InvitationFilterKey = (typeof INVITATION_FILTERS)[number]['key']

export function invitationFilterSql(key: string): SQL | undefined {
  const i = schema.invitations
  switch (key as InvitationFilterKey) {
    case 'nao-enviados':
      return isNull(i.sentAt)
    case 'enviados':
      return isNotNull(i.sentAt)
    case 'nao-acessados':
      return and(isNotNull(i.sentAt), isNull(i.firstAccessedAt))
    case 'acessaram-nao-confirmaram':
      return and(isNotNull(i.firstAccessedAt), eq(i.rsvpStatus, 'pending'))
    case 'confirmados':
      return eq(i.rsvpStatus, 'attending')
    case 'nao-comparecerao':
      return eq(i.rsvpStatus, 'declined')
    case 'pendentes':
      return eq(i.rsvpStatus, 'pending')
    default:
      return undefined
  }
}

/** Convite sem nenhum telefone (nem do convite, nem de alguém dele): ninguém para receber o link. */
export function noPhoneSql(): SQL {
  const i = schema.invitations
  return sql`(${i.phone} is null and not exists (select 1 from guests g where g.invitation_id = ${i.id} and g.removed_at is null and g.phone is not null))`
}

/** Filtros extras (combinam com as abas): telefone, tipo e grupo. */
export function invitationExtraSql(opts: { phone?: string; kind?: string; group?: string }): SQL[] {
  const i = schema.invitations
  const out: SQL[] = []
  if (opts.phone === 'sem') out.push(noPhoneSql())
  else if (opts.phone === 'com') out.push(not(noPhoneSql()))
  if (opts.kind && (INVITATION_KINDS as readonly string[]).includes(opts.kind)) out.push(eq(i.kind, opts.kind as (typeof INVITATION_KINDS)[number]))
  if (opts.group === 'sem') out.push(isNull(i.groupId))
  else if (opts.group && /^[0-9a-f-]{36}$/i.test(opts.group)) out.push(eq(i.groupId, opts.group))
  return out
}
