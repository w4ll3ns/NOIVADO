import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHead } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { ImportForm } from './ImportForm'

export const metadata: Metadata = { title: 'Importar convidados' }

export default async function ImportPage() {
  await requireAdmin('editor')
  return (
    <>
      <PageHead title="Importar convidados" subtitle="Planilha Excel ou CSV. Nada é gravado antes da sua confirmação." actions={<Link href="/admin/convites" className="a-btn">Voltar</Link>} />
      <ImportForm />
    </>
  )
}
