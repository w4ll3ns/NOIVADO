import { formatBRL } from '@/lib/format'

/** Os presentes do pedido e o total. */
export function ResumoPedido({ rows, totalCents }: { rows: { id: string; giftName: string; amountCents: number }[]; totalCents: number }) {
  return (
    <ul className="pedido-resumo">
      {rows.map((r) => (
        <li key={r.id}>
          <span>{r.giftName}</span>
          <span>{formatBRL(r.amountCents)}</span>
        </li>
      ))}
      {rows.length > 1 ? (
        <li className="pedido-resumo__total">
          <span>Total</span>
          <span>{formatBRL(totalCents)}</span>
        </li>
      ) : null}
    </ul>
  )
}
