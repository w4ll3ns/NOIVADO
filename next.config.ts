import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Tokens de convite nunca vazam para outros sites via Referer.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // payment=(self): o formulário do Mercado Pago roda num iframe do próprio site (modal de pagamento).
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(self), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  serverExternalPackages: ['exceljs', 'pdf-lib', '@pdf-lib/fontkit', 'qrcode', 'postgres'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      // Upload de imagens do admin (presentes, galeria do casal) via Server Actions.
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Pagamento no site: o formulário do Mercado Pago pode abrir janelas próprias.
      {
        source: '/presentes/pagamento/:path*',
        headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }],
      },
      // Modal de pagamento: a página vai num iframe do próprio site.
      {
        source: '/pagar/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/(i|a|admin)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]
  },
}

export default nextConfig
