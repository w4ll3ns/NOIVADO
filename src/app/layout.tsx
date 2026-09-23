import type { Metadata, Viewport } from 'next'
import { cormorant, garamond, pinyon } from './fonts'
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
    images: [{ url: '/brand/save-the-date.jpg', width: 882, height: 1280, alt: 'Save the Date — Noivado Maby e Chris' }],
  },
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
    <html lang="pt-BR" suppressHydrationWarning className={`${cormorant.variable} ${garamond.variable} ${pinyon.variable}`}>
      <body>{children}</body>
    </html>
  )
}
