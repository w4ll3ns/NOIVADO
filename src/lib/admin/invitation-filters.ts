import { and, eq, isNotNull, isNull, type SQL } from 'drizzle-orm'
import { schema } from '@/lib/db'

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
