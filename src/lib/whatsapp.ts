import type { InvitationKind, WhatsappTemplateKind } from '@/lib/db/schema'
import { normalizePhone } from '@/lib/format'

export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  const digits = normalizePhone(phone)
  if (!digits) return null
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`
}

export type TemplateRef = { id: string; kind: WhatsappTemplateKind; isDefault: boolean; name: string }

/** Modelo padrão para um convite: o escolhido no convite, ou pelo tipo (lembrete para quem acessou e não confirmou). */
export function defaultTemplateFor<T extends TemplateRef>(
  templates: T[],
  inv: { whatsappTemplateId: string | null; kind: InvitationKind; isCloseFamily: boolean },
  mode: 'invite' | 'reminder',
): T | undefined {
  const byKind = (k: WhatsappTemplateKind) => templates.find((t) => t.kind === k && t.isDefault) ?? templates.find((t) => t.kind === k)
  if (mode === 'reminder') return byKind('rsvp_reminder') ?? templates[0]
  if (inv.whatsappTemplateId) {
    const chosen = templates.find((t) => t.id === inv.whatsappTemplateId)
    if (chosen) return chosen
  }
  if (inv.isCloseFamily) return byKind('invite_close_family') ?? byKind('invite_family') ?? templates[0]
  const kindMap: Record<InvitationKind, WhatsappTemplateKind> = {
    individual: 'invite_individual',
    couple: 'invite_couple',
    family: 'invite_family',
    group: 'invite_family',
  }
  return byKind(kindMap[inv.kind]) ?? byKind('invite_individual') ?? templates[0]
}
