'use server'

import { findInvitationByToken, listGuests } from '@/lib/invitations'
import { getSettings } from '@/lib/settings'
import { endOfDayInTz } from '@/lib/format'
import { parseRsvpForm, RsvpError, submitRsvp } from '@/lib/rsvp'
import { rateLimit } from '@/lib/security/rate-limit'
import { getAdmin } from '@/lib/auth/session'

export type RsvpState = {
  ok?: boolean
  error?: string
  status?: 'attending' | 'declined'
  attendingCount?: number
}

export async function submitRsvpAction(token: string, _prev: RsvpState, form: FormData): Promise<RsvpState> {
  const found = await findInvitationByToken(token)
  if (!found) return { error: 'Não encontramos este convite. Confira o link que você recebeu.' }
  if (form.get('preview') === '1' && (await getAdmin())) {
    return { error: 'Pré-visualização do painel: a resposta não foi registrada.' }
  }
  const settings = await getSettings()
  const deadline = settings.rsvp.deadline ? endOfDayInTz(settings.rsvp.deadline) : null
  if (deadline && deadline.getTime() < Date.now()) return { error: settings.rsvp.closedText }
  if (!(await rateLimit(`rsvp:${found.invitation.id}`, 30, 3600))) {
    return { error: 'Muitas alterações em pouco tempo. Tente novamente mais tarde.' }
  }
  const guests = await listGuests(found.invitation.id)
  const input = parseRsvpForm(
    form,
    guests.filter((g) => !g.isCompanion).map((g) => g.id),
    found.invitation.allowCompanions ? found.invitation.maxCompanions : 0,
  )
  try {
    const result = await submitRsvp(found.invitation.id, input)
    return { ok: true, status: result.status, attendingCount: result.attendingCount }
  } catch (err) {
    if (err instanceof RsvpError) return { error: err.message }
    console.error(err)
    return { error: 'Não conseguimos registrar sua resposta agora. Tente novamente em instantes.' }
  }
}
