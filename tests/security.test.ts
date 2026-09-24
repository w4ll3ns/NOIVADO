import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { isValidTokenShape, randomToken } from '@/lib/security/tokens'
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password'
import { cleanLine, cleanText, isEmail } from '@/lib/sanitize'
import { mapMpStatus, verifyWebhookSignature } from '@/lib/payments/mercadopago'
import { nextStatus } from '@/lib/payments/transitions'

describe('tokens de convite', () => {
  it('são aleatórios, base62 e sem colisões em 20 mil amostras', () => {
    const set = new Set<string>()
    for (let i = 0; i < 20000; i++) {
      const t = randomToken(12)
      expect(t).toMatch(/^[0-9A-Za-z]{12}$/)
      set.add(t)
    }
    expect(set.size).toBe(20000)
  })

  it('valida o formato antes de consultar o banco', () => {
    expect(isValidTokenShape('abcDEF123456')).toBe(true)
    expect(isValidTokenShape("abc' OR 1=1")).toBe(false)
    expect(isValidTokenShape('curto')).toBe(false)
  })
})

describe('senhas', () => {
  it('hash scrypt verifica e rejeita', async () => {
    const hash = await hashPassword('noivado2026!')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('noivado2026!', hash)).toBe(true)
    expect(await verifyPassword('errada', hash)).toBe(false)
  })

  it('exige senhas razoáveis', () => {
    expect(validatePasswordStrength('curta1')).not.toBeNull()
    expect(validatePasswordStrength('somenteletras')).not.toBeNull()
    expect(validatePasswordStrength('boa-senha-2026')).toBeNull()
  })
})

describe('sanitização', () => {
  it('remove caracteres de controle e limita tamanho', () => {
    expect(cleanText('olá\u0000 mundo‮', 100)).toBe('olá mundo')
    expect(cleanLine('  muitos   espaços \n aqui ', 100)).toBe('muitos espaços aqui')
    expect(cleanText('x'.repeat(50), 10)).toHaveLength(10)
    expect(isEmail('ana@exemplo.com')).toBe(true)
    expect(isEmail('ana@')).toBe(false)
  })
})

describe('Mercado Pago', () => {
  const secret = 'segredo-de-teste'
  const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex')

  it('aceita assinatura válida e rejeita adulterada', () => {
    const ts = String(Date.now())
    const v1 = sign(`id:123456;request-id:req-1;ts:${ts};`)
    const header = `ts=${ts},v1=${v1}`
    expect(verifyWebhookSignature({ signatureHeader: header, requestId: 'req-1', dataId: '123456', secret, toleranceSeconds: 300 })).toBe(true)
    expect(verifyWebhookSignature({ signatureHeader: header, requestId: 'req-1', dataId: '999999', secret, toleranceSeconds: 300 })).toBe(false)
    expect(verifyWebhookSignature({ signatureHeader: null, requestId: 'req-1', dataId: '123456', secret })).toBe(false)
  })

  it('rejeita notificações antigas (replay)', () => {
    const ts = String(Date.now() - 3 * 3600_000)
    const header = `ts=${ts},v1=${sign(`id:1;request-id:r;ts:${ts};`)}`
    expect(verifyWebhookSignature({ signatureHeader: header, requestId: 'r', dataId: '1', secret, toleranceSeconds: 3600 })).toBe(false)
  })

  it('mapeia status', () => {
    expect(mapMpStatus('approved')).toBe('approved')
    expect(mapMpStatus('in_process')).toBe('awaiting')
    expect(mapMpStatus('rejected')).toBe('rejected')
    expect(mapMpStatus('cancelled', 'expired')).toBe('expired')
    expect(mapMpStatus('cancelled')).toBe('cancelled')
    expect(mapMpStatus('charged_back')).toBe('refunded')
  })

  it('pagamento aprovado não volta por notificação de outra tentativa', () => {
    const approved = { status: 'approved' as const, mpPaymentId: '10' }
    expect(nextStatus(approved, { status: 'rejected', mpPaymentId: '11' })).toBeNull()
    expect(nextStatus(approved, { status: 'refunded', mpPaymentId: '10' })).toBe('refunded')
    expect(nextStatus(approved, { status: 'approved', mpPaymentId: '10' })).toBeNull()
    expect(nextStatus({ status: 'rejected', mpPaymentId: '9' }, { status: 'approved', mpPaymentId: '10' })).toBe('approved')
    expect(nextStatus({ status: 'awaiting', mpPaymentId: null }, { status: 'awaiting', mpPaymentId: '10' })).toBe('awaiting')
  })
})
