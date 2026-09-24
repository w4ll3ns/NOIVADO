import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Crest } from '@/components/ornaments/Ornaments'
import { getAdmin } from '@/lib/auth/session'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Entrar' }

export default async function LoginPage(props: PageProps<'/admin/login'>) {
  if (await getAdmin()) redirect('/admin')
  const sp = await props.searchParams
  const next = typeof sp.next === 'string' ? sp.next : '/admin'
  return (
    <main className="a-login">
      <div className="a-login__card">
        <Crest />
        <p className="script" style={{ fontSize: '2.6rem', margin: '6px 0 0' }}>
          Maby &amp; Chris
        </p>
        <p className="caps" style={{ fontSize: '0.72rem' }}>
          Painel do noivado
        </p>
        <LoginForm next={next} />
      </div>
    </main>
  )
}
