import 'server-only'
import { db, schema } from '@/lib/db'
import { clientIp, hashIp } from '@/lib/request'

export async function audit(
  adminId: string | null,
  action: string,
  entity?: string | null,
  entityId?: string | null,
  details?: Record<string, unknown>,
) {
  try {
    await db.insert(schema.auditLogs).values({
      adminId,
      action,
      entity: entity ?? null,
      entityId: entityId ?? null,
      details: details ?? null,
      ipHash: hashIp(await clientIp()),
    })
  } catch (err) {
    console.error('Falha ao registrar auditoria', err)
  }
}
