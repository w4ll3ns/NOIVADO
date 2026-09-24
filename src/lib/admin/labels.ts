import type { InvitationEventType, InvitationKind, PaymentStatus, PhotoStatus, RsvpStatus, WhatsappTemplateKind } from '@/lib/db/schema'
import { formatBRL } from '@/lib/format'

export const KIND_LABEL: Record<InvitationKind, string> = {
  individual: 'Individual',
  couple: 'Casal',
  family: 'Família',
  group: 'Grupo',
}

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  pending: 'Aguardando',
  attending: 'Confirmado',
  declined: 'Não comparecerá',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  awaiting: 'Aguardando pagamento',
  approved: 'Aprovado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  refunded: 'Reembolsado',
}

export const PHOTO_LABEL: Record<PhotoStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  hidden: 'Oculta',
  rejected: 'Rejeitada',
}

export const TEMPLATE_KIND_LABEL: Record<WhatsappTemplateKind, string> = {
  invite_individual: 'Convite individual',
  invite_couple: 'Convite casal',
  invite_family: 'Convite família',
  invite_close_family: 'Familiares próximos',
  rsvp_reminder: 'Lembrete RSVP',
  thanks_after_rsvp: 'Agradecimento após confirmação',
  final_reminder: 'Lembrete final',
  custom: 'Personalizado',
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  bank_transfer: 'Pix / transferência',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  ticket: 'Boleto',
  bolbradesco: 'Boleto',
  pec: 'Boleto',
  account_money: 'Saldo Mercado Pago',
}

export function paymentMethodLabel(method: string | null, type: string | null) {
  if (method && PAYMENT_METHOD_LABEL[method]) return PAYMENT_METHOD_LABEL[method]
  if (type && PAYMENT_METHOD_LABEL[type]) return PAYMENT_METHOD_LABEL[type]
  return method ? method.toUpperCase() : '—'
}

type EventData = Record<string, unknown> | null

/** Texto da linha do tempo — linguagem cuidadosa: "o link foi acessado", nunca "Fulano viu". */
export function eventLabel(type: InvitationEventType, data: EventData): string {
  const d = data ?? {}
  const gift = typeof d.gift === 'string' ? d.gift : ''
  const amount = typeof d.amountCents === 'number' ? ` (${formatBRL(d.amountCents)})` : ''
  switch (type) {
    case 'created':
      return 'Convite cadastrado'
    case 'updated':
      return 'Convite editado'
    case 'whatsapp_prepared':
      return 'Convite preparado para envio no WhatsApp'
    case 'reminder_prepared':
      return 'Lembrete preparado no WhatsApp'
    case 'marked_sent':
      return 'Marcado como enviado pelo WhatsApp'
    case 'unmarked_sent':
      return 'Envio desmarcado'
    case 'link_accessed':
      return 'Link acessado pela primeira vez'
    case 'link_revisited':
      return 'Link acessado novamente'
    case 'event_info_viewed':
      return 'Informações do evento visualizadas'
    case 'gifts_viewed':
      return 'Lista de presentes visualizada'
    case 'rsvp_submitted':
      return d.status === 'declined' ? 'Informou que não poderá comparecer' : `Presença confirmada${typeof d.attendingCount === 'number' ? ` (${d.attendingCount})` : ''}`
    case 'rsvp_changed':
      return d.status === 'declined'
        ? 'Alterou para não comparecer'
        : `Alterou a confirmação${typeof d.attendingCount === 'number' ? ` (${d.attendingCount} confirmados)` : ''}${d.manual ? ' — registrado pelo painel' : ''}`
    case 'gift_selected':
      return `Presente selecionado: ${gift}${amount}`
    case 'payment_approved':
      return `Pagamento aprovado: ${gift}${amount}`
    case 'payment_failed':
      return `Pagamento não aprovado: ${gift}`
    case 'payment_refunded':
      return `Pagamento estornado: ${gift}`
    case 'message_sent':
      return d.source === 'gift' ? 'Mensagem enviada aos noivos (presente)' : 'Mensagem enviada aos noivos'
    case 'photo_uploaded':
      return 'Participou do álbum com fotos'
    case 'token_regenerated':
      return 'Novo link gerado (o anterior foi desativado)'
    default:
      return type
  }
}
