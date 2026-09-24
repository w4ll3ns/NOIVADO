import type { PaymentStatus } from '@/lib/db/schema'

/** Transições permitidas: um pagamento aprovado só "volta" por reembolso/estorno do mesmo pagamento. */
export function nextStatus(
  current: { status: PaymentStatus; mpPaymentId: string | null },
  incoming: { status: PaymentStatus; mpPaymentId: string },
): PaymentStatus | null {
  if (current.status === incoming.status && current.mpPaymentId === incoming.mpPaymentId) return null
  if (current.status === 'refunded') return null
  if (current.status === 'approved') {
    if (incoming.mpPaymentId !== current.mpPaymentId) return null
    return incoming.status === 'refunded' || incoming.status === 'cancelled' ? incoming.status : null
  }
  return incoming.status
}
