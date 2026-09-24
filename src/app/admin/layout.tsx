import type { Metadata } from 'next'
import '@/styles/admin.css'

export const metadata: Metadata = {
  title: { default: 'Painel', template: '%s · Painel Maby & Chris' },
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>
}
