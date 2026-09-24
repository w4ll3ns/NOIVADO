import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, desc, eq } from 'drizzle-orm'
import { PageHead, PaymentBadge } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { mediaUrl } from '@/lib/media'
import { formatBRL, formatDateTime } from '@/lib/format'
import { GiftAdminForm } from '../GiftAdminForm'
import { saveGiftAction } from '../actions'

export const metadata: Metadata = { title: 'Editar presente' }

const money = (c: number | null) => (c ? (c / 100).toFixed(2).replace('.', ',') : '')

export default async function EditGiftPage(props: PageProps<'/admin/presentes/[id]'>) {
  await requireAdmin('editor')
  const { id } = await props.params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const [gift] = await db.select().from(schema.gifts).where(eq(schema.gifts.id, id))
  if (!gift) notFound()
  const [categories, payments] = await Promise.all([
    db.select({ id: schema.giftCategories.id, name: schema.giftCategories.name }).from(schema.giftCategories).orderBy(asc(schema.giftCategories.sortOrder)),
    db.select().from(schema.giftPayments).where(eq(schema.giftPayments.giftId, id)).orderBy(desc(schema.giftPayments.createdAt)),
  ])
  return (
    <>
      <PageHead title={gift.name} actions={<Link href="/admin/presentes" className="a-btn">Voltar</Link>} />
      <div className="a-grid a-grid--main">
        <GiftAdminForm
          action={saveGiftAction.bind(null, id)}
          categories={categories}
          imageUrl={mediaUrl(gift.mediaId, 'thumb')}
          initial={{
            name: gift.name,
            description: gift.description ?? '',
            categoryId: gift.categoryId ?? '',
            icon: gift.icon ?? 'presente',
            priceType: gift.priceType,
            amount: money(gift.amountCents),
            min: money(gift.minCents),
            max: money(gift.maxCents),
            suggested: money(gift.suggestedCents),
            quick: (gift.quickAmountsCents ?? []).map(money).join('; '),
            availability: gift.availability,
            quantity: gift.quantity ?? 1,
            featured: gift.featured,
            isActive: gift.isActive,
            sortOrder: gift.sortOrder,
          }}
        />
        <section className="a-card">
          <h2 className="a-card__title">Quem presenteou</h2>
          {payments.length ? (
            <ul className="a-list-plain">
              {payments.map((p) => (
                <li key={p.id}>
                  <strong>{p.payerName}</strong> · {formatBRL(p.amountCents)} <PaymentBadge status={p.status} />
                  <div className="a-muted">{formatDateTime(p.createdAt)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="a-muted">Ninguém ainda.</p>
          )}
        </section>
      </div>
    </>
  )
}
