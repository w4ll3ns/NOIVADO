import type { Metadata } from 'next'
import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { PageHead } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { GiftAdminForm } from '../GiftAdminForm'
import { saveGiftAction } from '../actions'

export const metadata: Metadata = { title: 'Novo presente' }

export default async function NewGiftPage() {
  await requireAdmin('editor')
  const categories = await db.select({ id: schema.giftCategories.id, name: schema.giftCategories.name }).from(schema.giftCategories).orderBy(asc(schema.giftCategories.sortOrder))
  return (
    <>
      <PageHead title="Novo presente" actions={<Link href="/admin/presentes" className="a-btn">Voltar</Link>} />
      <GiftAdminForm
        action={saveGiftAction.bind(null, null)}
        categories={categories}
        imageUrl={null}
        initial={{ name: '', description: '', categoryId: categories[0]?.id ?? '', icon: 'presente', priceType: 'fixed', amount: '', min: '50', max: '', suggested: '200', quick: '100; 200; 300; 500', availability: 'unlimited', quantity: 1, featured: false, isActive: true, sortOrder: 100 }}
      />
    </>
  )
}
