'use server'

import { db, schema } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest, logInvitationEvent } from '@/lib/invitations'
import { cleanLine, cleanText } from '@/lib/sanitize'
import { clientIp, hashIp } from '@/lib/request'
import { rateLimit } from '@/lib/security/rate-limit'

export type GuestbookState = { ok?: boolean; error?: string; name?: string; message?: string }

export async function sendGuestbookMessage(_prev: GuestbookState, form: FormData): Promise<GuestbookState> {
  const settings = await getSettings()
  if (!settings.guestbook.enabled) return { error: 'O livro de mensagens está fechado no momento.' }
  const name = cleanLine(form.get('name'), 80)
  const message = cleanText(form.get('message'), 2000)
  // Campo invisível: robôs preenchem, pessoas não.
  if (cleanLine(form.get('website'))) return { ok: true }
  if (name.length < 2) return { error: 'Conte para nós quem está escrevendo.', name, message }
  if (message.length < 2) return { error: 'Escreva sua mensagem antes de enviar.', name, message }
  if (!(await rateLimit(`guestbook:${hashIp(await clientIp())}`, 6, 3600))) {
    return { error: 'Recebemos muitas mensagens deste aparelho. Tente novamente mais tarde.', name, message }
  }
  const guest = await getCurrentGuest()
  const [row] = await db
    .insert(schema.messages)
    .values({ source: 'guestbook', authorName: name, content: message, invitationId: guest?.invitation.id ?? null })
    .returning({ id: schema.messages.id })
  if (guest) await logInvitationEvent(guest.invitation.id, 'message_sent', { data: { source: 'guestbook', messageId: row.id } })
  return { ok: true, name }
}
