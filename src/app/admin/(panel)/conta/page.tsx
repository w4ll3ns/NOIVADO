import type { Metadata } from 'next'
import { PageHead } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { ChangePasswordForm } from '../equipe/Forms'

export const metadata: Metadata = { title: 'Minha conta' }

export default async function AccountPage() {
  const admin = await requireAdmin()
  return (
    <>
      <PageHead title="Minha conta" subtitle={`${admin.name} · ${admin.email}`} />
      <section className="a-card">
        <h2 className="a-card__title">Alterar senha</h2>
        <ChangePasswordForm />
      </section>
    </>
  )
}
