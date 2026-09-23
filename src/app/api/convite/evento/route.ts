import { z } from 'zod'
import { getCurrentGuest, logInvitationEventThrottled } from '@/lib/invitations'
import { isSameOrigin } from '@/lib/request'

const body = z.object({ type: z.enum(['event_info_viewed', 'gifts_viewed']) })

/** Visualizações relevantes (informações do evento, lista de presentes) — no máximo 1x a cada 6h. */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return Response.json({ ok: false }, { status: 403 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 })
  const guest = await getCurrentGuest()
  if (!guest) return Response.json({ ok: true, anonymous: true })
  await logInvitationEventThrottled(guest.invitation.id, parsed.data.type)
  return Response.json({ ok: true })
}
