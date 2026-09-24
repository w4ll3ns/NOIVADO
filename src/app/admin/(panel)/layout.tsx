import Link from 'next/link'
import { AdminNav, type AdminNavItem } from '@/components/admin/AdminNav'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { requireAdmin } from '@/lib/auth/session'
import { logoutAction } from '../login/actions'

const ROLE_LABEL = { owner: 'Proprietário', editor: 'Editor', viewer: 'Leitura' } as const

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  const i = (name: string) => <EngravedIcon name={name} />
  const items: AdminNavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: i('estrela') },
    { href: '/admin/convites', label: 'Convites', icon: i('envelope'), group: 'Convidados' },
    { href: '/admin/convidados', label: 'Convidados', icon: i('aliancas'), group: 'Convidados' },
    { href: '/admin/rsvp', label: 'RSVP', icon: i('coracao'), group: 'Convidados' },
    { href: '/admin/whatsapp', label: 'WhatsApp', icon: i('balanca'), group: 'Convidados' },
    { href: '/admin/presentes', label: 'Presentes', icon: i('presente'), group: 'Presentes' },
    { href: '/admin/pagamentos', label: 'Pagamentos', icon: i('chave'), group: 'Presentes' },
    { href: '/admin/mensagens', label: 'Mensagens', icon: i('envelope'), group: 'Presentes' },
    { href: '/admin/album', label: 'Álbum', icon: i('camera'), group: 'Fotos' },
    { href: '/admin/fotos', label: 'Fotos', icon: i('estrela'), group: 'Fotos' },
    { href: '/admin/galeria', label: 'Galeria do casal', icon: i('vaso'), group: 'Fotos' },
    { href: '/admin/faq', label: 'FAQ', icon: i('mapa'), group: 'Site' },
    { href: '/admin/configuracoes', label: 'Configurações', icon: i('casa'), group: 'Site' },
    ...(admin.role === 'owner'
      ? [
          { href: '/admin/equipe', label: 'Equipe', icon: i('aliancas'), group: 'Site' },
          { href: '/admin/logs', label: 'Registros', icon: i('relogio'), group: 'Site' },
        ]
      : []),
  ]
  return (
    <div className="a-shell">
      <AdminNav
        items={items}
        footer={
          <>
            <div style={{ color: 'var(--a-text)', fontWeight: 600 }}>{admin.name}</div>
            <div>{ROLE_LABEL[admin.role]}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Link href="/admin/conta" className="a-btn a-btn--sm">
                Minha conta
              </Link>
              <Link href="/" className="a-btn a-btn--sm" target="_blank">
                Ver site
              </Link>
              <form action={logoutAction}>
                <button className="a-btn a-btn--sm a-btn--ghost">Sair</button>
              </form>
            </div>
          </>
        }
      />
      <main className="a-main" id="conteudo">
        {children}
      </main>
    </div>
  )
}
