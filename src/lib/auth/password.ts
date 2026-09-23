import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// scrypt (memory-hard) com parâmetros recomendados pela OWASP: N=2^17, r=8, p=1.
const N = 2 ** 17
const R = 8
const P = 1
const KEYLEN = 64
const MAXMEM = 256 * 1024 * 1024

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, keyB64] = parts
  const expected = Buffer.from(keyB64, 'base64')
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

/** Hash fixo usado quando o e-mail não existe, para igualar o tempo de resposta. */
export const DUMMY_HASH =
  'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64')

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return 'A senha precisa ter pelo menos 10 caracteres.'
  if (password.length > 200) return 'Senha muito longa.'
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use letras e números.'
  return null
}
