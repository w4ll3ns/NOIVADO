import 'server-only'

/**
 * Variáveis de ambiente lidas sob demanda (nunca expostas ao navegador).
 * Nenhum segredo usa o prefixo NEXT_PUBLIC_.
 */
export const env = {
  get isProduction() {
    return process.env.NODE_ENV === 'production'
  },
  get appUrl() {
    return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
  },
  get appSecret() {
    const secret = process.env.APP_SECRET
    if (!secret || secret.length < 32) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('APP_SECRET precisa ter pelo menos 32 caracteres em produção.')
      }
      return 'dev-only-secret-dev-only-secret-dev-only'
    }
    return secret
  },
  get trustProxy() {
    return process.env.TRUST_PROXY !== 'false'
  },
  get mpAccessToken() {
    return process.env.MP_ACCESS_TOKEN || null
  },
  get mpWebhookSecret() {
    return process.env.MP_WEBHOOK_SECRET || null
  },
  /** Simulação de pagamento: apenas fora de produção e sem credenciais do Mercado Pago. */
  get paymentsSimulation() {
    return (
      process.env.NODE_ENV !== 'production' &&
      process.env.PAYMENTS_SIMULATION === 'true' &&
      !process.env.MP_ACCESS_TOKEN
    )
  },
  get storageDriver(): 'local' | 's3' {
    return process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local'
  },
  get storageLocalDir() {
    return process.env.STORAGE_LOCAL_DIR || './storage'
  },
  get maxUploadBytes() {
    return Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024
  },
}
