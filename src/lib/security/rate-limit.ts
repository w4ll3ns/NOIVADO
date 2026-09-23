import 'server-only'
import { sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

/**
 * Limite de requisições em janela fixa, persistido no Postgres
 * (funciona com várias instâncias da aplicação).
 * Retorna `true` se a requisição pode seguir.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const resetAt = new Date(Date.now() + windowSeconds * 1000)
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`CASE WHEN ${schema.rateLimits.resetAt} < now() THEN 1 ELSE ${schema.rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${schema.rateLimits.resetAt} < now() THEN ${resetAt.toISOString()}::timestamptz ELSE ${schema.rateLimits.resetAt} END`,
      },
    })
    .returning({ count: schema.rateLimits.count })
  // Limpeza oportunista de chaves vencidas.
  if (Math.random() < 0.01) {
    await db.delete(schema.rateLimits).where(sql`${schema.rateLimits.resetAt} < now() - interval '1 day'`)
  }
  return row.count <= limit
}

export async function resetRateLimit(key: string) {
  await db.delete(schema.rateLimits).where(sql`${schema.rateLimits.key} = ${key}`)
}
