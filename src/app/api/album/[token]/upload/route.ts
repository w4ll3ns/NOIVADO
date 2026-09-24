import { findAlbumByToken, savePhoto } from '@/lib/album'
import { albumUploadState } from '@/lib/album-state'
import { env } from '@/lib/env'
import { ImageError } from '@/lib/images'
import { getCurrentGuest, logInvitationEventThrottled } from '@/lib/invitations'
import { clientIpFrom, hashIp, isSameOrigin } from '@/lib/request'
import { cleanLine } from '@/lib/sanitize'
import { rateLimit } from '@/lib/security/rate-limit'

const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status })

export async function POST(req: Request, ctx: RouteContext<'/api/album/[token]/upload'>) {
  if (!isSameOrigin(req.headers)) return json({ error: 'Origem inválida.' }, 403)
  const { token } = await ctx.params
  const found = await findAlbumByToken(token)
  if (!found) return json({ error: 'Álbum não encontrado.' }, 404)
  const { album } = found
  if (albumUploadState(album) !== 'open') {
    return json({ error: album.closedMessage || 'O álbum não está recebendo fotos agora.' }, 409)
  }

  const ipHash = hashIp(clientIpFrom(req.headers))
  if (!(await rateLimit(`upload:${ipHash}`, 80, 3600))) {
    return json({ error: 'Recebemos muitas fotos deste aparelho em pouco tempo. Aguarde alguns minutos.' }, 429)
  }

  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > env.maxUploadBytes + 1024 * 1024) return json({ error: 'Foto muito grande.' }, 413)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'Não conseguimos receber a foto. Tente novamente.' }, 400)
  }
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Nenhuma foto recebida.' }, 400)
  if (file.size > env.maxUploadBytes) return json({ error: 'Foto muito grande.' }, 413)

  const source = form.get('source') === 'camera' ? 'camera' : 'gallery'
  if (source === 'camera' && !album.allowCamera) return json({ error: 'Envio pela câmera desativado.' }, 403)
  if (source === 'gallery' && !album.allowGalleryUpload) return json({ error: 'Envio pela galeria desativado.' }, 403)

  const guest = await getCurrentGuest()
  const uploaderName = cleanLine(form.get('name'), 80) || null
  if (!album.allowAnonymous && !uploaderName && !guest) {
    return json({ error: 'Conte para nós o seu nome antes de enviar.' }, 400)
  }

  try {
    const photo = await savePhoto({
      album,
      tokenId: found.tokenId,
      invitationId: guest?.invitation.id ?? null,
      file: Buffer.from(await file.arrayBuffer()),
      originalName: cleanLine(file.name, 120) || null,
      uploaderName: uploaderName ?? (guest ? guest.greeting : null),
      showNamePublicly: form.get('showName') === '1',
      source,
      ipHash,
    })
    if (guest) await logInvitationEventThrottled(guest.invitation.id, 'photo_uploaded', 1)
    return json({ ok: true, status: photo.status })
  } catch (err) {
    if (err instanceof ImageError) return json({ error: err.message }, 415)
    console.error('Falha no upload de foto', err)
    return json({ error: 'Não conseguimos salvar a foto. Tente novamente.' }, 500)
  }
}
