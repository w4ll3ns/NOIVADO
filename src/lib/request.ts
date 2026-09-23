import 'server-only'
import { headers } from 'next/headers'
import { env } from '@/lib/env'
import { hmacSha256 } from '@/lib/security/tokens'

export function clientIpFrom(h: Headers): string {
  if (env.trustProxy) {
    const xff = h.get('x-forwarded-for')
    if (xff) return xff.split(',')[0].trim()
    const real = h.get('x-real-ip')
    if (real) return real.trim()
  }
  return 'unknown'
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers())
}

/** IP nunca é guardado em claro (LGPD): apenas um HMAC para limitar abuso. */
export function hashIp(ip: string): string {
  return hmacSha256(env.appSecret, `ip:${ip}`).slice(0, 32)
}

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|twitterbot|linkedin|preview|embedly|discord|skype|headless|curl|wget|python|axios|node-fetch/i

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true
  return BOT_UA.test(ua)
}

/** Confirma que a requisição veio do próprio site (CSRF para route handlers). */
export function isSameOrigin(h: Headers): boolean {
  const origin = h.get('origin')
  if (!origin) return h.get('sec-fetch-site') === 'same-origin'
  const host = h.get('x-forwarded-host') ?? h.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
