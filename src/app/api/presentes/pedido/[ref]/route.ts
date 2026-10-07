import { getOrder, syncPaymentWithMp } from '@/lib/payments/service'
import { rateLimit } from '@/lib/security/rate-limit'

/**
 * Situação do pedido, para a página de pagamento atualizar sozinha (ex.: Pix pago no app do banco).
 * Vem do nosso banco (webhook); se o webhook atrasar, consulta o Mercado Pago no máximo a cada 10 s.
 */
export async function GET(_req: Request, ctx: RouteContext<'/api/presentes/pedido/[ref]'>) {
  const { ref } = await ctx.params
  let order = await getOrder(ref)
  if (!order) return Response.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (order.status === 'awaiting' && order.provider === 'mercadopago' && order.rows[0].mpPaymentId && (await rateLimit(`sync:${order.reference}`, 1, 10))) {
    await syncPaymentWithMp(order.reference, 'return')
    order = (await getOrder(ref)) ?? order
  }
  return Response.json({ status: order.status }, { headers: { 'Cache-Control': 'no-store' } })
}
