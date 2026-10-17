import type { Metadata } from 'next'
import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { PageHead } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { AdicionarPorLinks } from './AdicionarPorLinks'

export const metadata: Metadata = { title: 'Adicionar presentes por links' }

export default async function LinksPage() {
  await requireAdmin('editor')
  const categories = await db
    .select({ id: schema.giftCategories.id, name: schema.giftCategories.name })
    .from(schema.giftCategories)
    .orderBy(asc(schema.giftCategories.sortOrder))
  return (
    <>
      <PageHead
        title="Adicionar presentes por links"
        subtitle="Cole os links dos produtos: o painel traz nome, valor, foto e descrição."
        actions={
          <Link href="/admin/presentes" className="a-btn">
            Voltar
          </Link>
        }
      />
      <AdicionarPorLinks categories={categories} />
    </>
  )
}
