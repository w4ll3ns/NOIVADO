import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/**
 * Token aleatório em base62 sem viés (rejection sampling).
 * 12 caracteres ≈ 71 bits de entropia: impossível de adivinhar ou enumerar.
 */
export function randomToken(length = 12): string {
  let out = ''
  while (out.length < length) {
    const bytes = randomBytes(length * 2)
    for (const b of bytes) {
      // 248 = 62 * 4 → descarta valores que introduziriam viés
      if (b < 248) out += BASE62[b % 62]
      if (out.length === length) break
    }
  }
  return out
}

export function isValidTokenShape(token: string, min = 8, max = 64): boolean {
  return token.length >= min && token.length <= max && /^[0-9A-Za-z]+$/.test(token)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
