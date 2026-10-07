import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Pagamento } from '@/components/gifts/Pagamento'
import { pagarNoMercadoPago } from '@/components/gifts/planoB'
import { dadosPagamento } from '@/lib/payments/pagina'
import { AvisarAoAbrir, BotaoFechar, SoNoModal } from './Avisos'

export const metadata: Metadata = { title: 'Pagamento', robots: { index: false, follow: false } }

/**
 * Pix e cartão dentro do modal do "Finalizar presentes" (num iframe). A página tem a própria política
 * de segurança, que libera o formulário do Mercado Pago, sem afrouxar a do resto do site.
 */
export default async function PagarNoModal(props: PageProps<'/pagar/[ref]'>) {
  const { ref } = await props.params
  const dados = await dadosPagamento(ref)
  if (!dados) notFound()
  const { order, problem, tela } = dados

  return (
    <main className="pagar-embed">
      <SoNoModal orderRef={order.reference} />
      {order.status === 'approved' ? (
        <>
          <AvisarAoAbrir msg={{ tipo: 'mc-pago', ref: order.reference }} />
          <p className="pagamento__texto">Pagamento confirmado. Obrigado pelo carinho!</p>
        </>
      ) : problem || order.status === 'refunded' ? (
        <div className="pagar-embed__problema">
          <p className="notice notice--error" role="alert">
            {problem ?? 'Este pedido foi estornado. Para presentear de novo, volte à lista.'}
          </p>
          <BotaoFechar />
        </div>
      ) : (
        <Pagamento {...tela} embed fallback={pagarNoMercadoPago.bind(null, order.reference)} />
      )}
    </main>
  )
}
