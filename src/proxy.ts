import { NextResponse, type NextRequest } from 'next/server'

import { adminCookieName } from '@/lib/auth/constants'

const MP_FORM_TARGETS = 'https://*.mercadopago.com.br https://*.mercadopago.com https://*.mercadolivre.com'
/**
 * Só na página de pagamento: o formulário seguro do Mercado Pago (SDK, campos do cartão em iframes,
 * imagens das bandeiras e a API de tokenização) vem destes domínios.
 */
const MP_CHECKOUT =
  'https://*.mercadopago.com https://*.mercadopago.com.br https://*.mercadolibre.com https://*.mercadolivre.com https://*.mercadolivre.com.br https://*.mlstatic.com'
/**
 * O formulário do cartão pode injetar scripts próprios e usar eval, o que a política com nonce +
 * 'strict-dynamic' bloqueia. Na página de pagamento vale a política "sem nonce" do Next
 * ('unsafe-inline' + lista de domínios). Ela só vale se a página for carregada inteira: os links
 * para cá usam <a>/location, não navegação interna.
 */
const MP_SCRIPTS = `${MP_CHECKOUT} https://applepay.cdn-apple.com https://pay.google.com`

function buildCsp(nonce: string, isDev: boolean, checkout: boolean) {
  const mp = checkout ? ` ${MP_CHECKOUT}` : ''
  return [
    `default-src 'self'`,
    checkout
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${MP_SCRIPTS}`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'${mp}`,
    `img-src 'self' blob: data:${mp}`,
    `font-src 'self'${mp}`,
    `media-src 'self' blob:`,
    `connect-src 'self'${mp}`,
    ...(checkout ? [`frame-src 'self'${mp} https://pay.google.com`, `worker-src 'self' blob:`] : []),
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' ${MP_FORM_TARGETS}`,
    `frame-ancestors 'none'`,
    ...(isDev || process.env.FORCE_HTTPS === 'false' ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production'
  const { pathname, search } = request.nextUrl

  // HTTPS obrigatório (atrás de proxy reverso/CDN que informa o protocolo original).
  if (!isDev && process.env.FORCE_HTTPS !== 'false' && request.headers.get('x-forwarded-proto') === 'http') {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    return NextResponse.redirect(`https://${host}${pathname}${search}`, 308)
  }

  // Área administrativa: sem cookie de sessão, vai para o login.
  // (A sessão é validada de verdade no servidor, em cada página e ação.)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !request.cookies.get(adminCookieName())) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce, isDev, pathname.startsWith('/presentes/pagamento/'))
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|brand|m/|p/|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
