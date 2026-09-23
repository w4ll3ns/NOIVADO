import { z } from 'zod'
import { findInvitationByToken, recordInvitationAccess, setGuestCookie } from '@/lib/invitations'
import { getAdmin } from '@/lib/auth/session'
import { clientIpFrom, hashIp, isBotUserAgent, isSameOrigin } from '@/lib/request'
import { rateLimit } from '@/lib/security/rate-limit'

const body = z.object({ token: z.string().min(8).max(40), preview: z.boolean().optional() })

/**
 * "Link acessado": chamado pelo navegador depois que a página do convite carrega.
 * Robôs de prévia de link (WhatsApp etc.) não executam JavaScript e não chegam aqui.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return Response.json({ ok: false }, { status: 403 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 })
  if (!(await rateLimit(`access:${hashIp(clientIpFrom(req.headers))}`, 120, 3600))) {
    return Response.json({ ok: false }, { status: 429 })
  }
  const found = await findInvitationByToken(parsed.data.token)
  if (!found) return Response.json({ ok: false }, { status: 404 })

  // Pré-visualização pelo painel: não conta acesso e não "vira" o convidado neste navegador.
  if (parsed.data.preview && (await getAdmin())) return Response.json({ ok: true, preview: true })

  await setGuestCookie(parsed.data.token)
  if (!isBotUserAgent(req.headers.get('user-agent'))) {
    await recordInvitationAccess(found.invitation.id)
  }
  return Response.json({ ok: true })
}
