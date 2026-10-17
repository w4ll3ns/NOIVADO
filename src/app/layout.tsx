import type { Metadata, Viewport } from 'next'
import { garamond, monteCarlo } from './fonts'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/casarao.css'
import '@/styles/site.css'
import '@/styles/intro.css'

const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Maby & Chris · Noivado',
    template: '%s · Maby & Chris',
  },
  description: 'Noivado de Maby & Chris — 31 de outubro de 2026, Casa de Zaquia, Centro Histórico de São Luís.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Maby & Chris',
    title: 'Maby & Chris · Noivado',
    description: '31 de outubro de 2026 · Casa de Zaquia · Centro Histórico de São Luís',
    // Prévia dos links (WhatsApp etc.): horizontal 1200×630, que o WhatsApp mostra grande. Nome novo de
    // arquivo para o WhatsApp não reaproveitar a prévia antiga do cache dele.
    images: [{ url: '/brand/noivado-convite.jpg', width: 1200, height: 630, alt: 'Noivado de Maby e Chris — 31 de outubro de 2026, Casa de Zaquia' }],
  },
  twitter: { card: 'summary_large_image', images: ['/brand/noivado-convite.jpg'] },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  themeColor: '#f8ede5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${garamond.variable} ${monteCarlo.variable}`}>
      <body>{children}</body>
    </html>
  )
}
