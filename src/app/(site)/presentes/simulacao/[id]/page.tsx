import { notFound, redirect } from 'next/navigation'
import { env } from '@/lib/env'
import { getPaymentById, simulatePayment } from '@/lib/payments/service'
import { formatBRL } from '@/lib/format'

/** Somente em desenvolvimento (sem credenciais do Mercado Pago): simula o checkout. */
export default async function SimulationPage(props: PageProps<'/presentes/simulacao/[id]'>) {
  if (!env.paymentsSimulation) notFound()
  const { id } = await props.params
  const payment = await getPaymentById(id)
  if (!payment || payment.provider !== 'simulation') notFound()

  async function decide(form: FormData) {
    'use server'
    const outcome = form.get('outcome')
    if (outcome !== 'approved' && outcome !== 'rejected' && outcome !== 'pending') return
    await simulatePayment(id, outcome)
    redirect(`/presentes/retorno?ref=${id}`)
  }

  return (
    <div className="container narrow" style={{ paddingBlock: 60 }}>
      <div className="paper center">
        <p className="eyebrow">Modo de demonstração</p>
        <h1 className="section-title" style={{ fontSize: '1.8rem' }}>
          Simulação do Mercado Pago
        </h1>
        <p className="muted" style={{ margin: '12px 0 20px' }}>
          {payment.giftName} · {formatBRL(payment.amountCents)} · {payment.payerName}
        </p>
        <p className="notice" style={{ textAlign: 'left' }}>
          Configure <code>MP_ACCESS_TOKEN</code> para usar o checkout real. Esta página não existe em produção.
        </p>
        <form action={decide} className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn btn--primary" name="outcome" value="approved">
            Aprovar pagamento
          </button>
          <button className="btn" name="outcome" value="pending">
            Deixar pendente (Pix/boleto)
          </button>
          <button className="btn" name="outcome" value="rejected">
            Recusar pagamento
          </button>
        </form>
      </div>
    </div>
  )
}
