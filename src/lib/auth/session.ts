import 'server-only'
import { cache } from 'react'
import { randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { sha256 } from '@/lib/security/tokens'
import { env } from '@/lib/env'
import { clientIpFrom, hashIp } from '@/lib/request'
import type { AdminRole } from '@/lib/db/schema'
import { adminCookieName } from './constants'

const SESSION_DAYS = 7
const ABSOLUTE_DAYS = 30

export type AdminUser = { id: string; name: string; email: string; role: AdminRole; sessionId: string }

const ROLE_RANK: Record<AdminRole, number> = { viewer: 0, editor: 1, owner: 2 }

export function hasRole(user: Pick<AdminUser, 'role'>, min: AdminRole) {
  return ROLE_RANK[user.role] >= ROLE_RANK[min]
}

export async function createAdminSession(adminId: string) {
  const token = randomBytes(32).toString('base64url')
  const h = await headers()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000)
  await db.insert(schema.adminSessions).values({
    adminId,
    tokenHash: sha256(token),
    ipHash: hashIp(clientIpFrom(h)),
    userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
    expiresAt,
  })
  // Remove sessões vencidas deste admin.
  await db.delete(schema.adminSessions).where(and(eq(schema.adminSessions.adminId, adminId), lt(schema.adminSessions.expiresAt, new Date())))
  const jar = await cookies()
  jar.set(adminCookieName(), token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const jar = await cookies()
  const token = jar.get(adminCookieName())?.value
  if (!token || token.length > 100) return null
  const [row] = await db
    .select({
      sessionId: schema.adminSessions.id,
      createdAt: schema.adminSessions.createdAt,
      lastSeenAt: schema.adminSessions.lastSeenAt,
      id: schema.admins.id,
      name: schema.admins.name,
      email: schema.admins.email,
      role: schema.admins.role,
    })
    .from(schema.adminSessions)
    .innerJoin(schema.admins, eq(schema.admins.id, schema.adminSessions.adminId))
    .where(
      and(
        eq(schema.adminSessions.tokenHash, sha256(token)),
        gt(schema.adminSessions.expiresAt, new Date()),
        isNull(schema.admins.disabledAt),
      ),
    )
    .limit(1)
  if (!row) return null
  // Sessão deslizante (renovada no máximo 1x por hora), limitada a 30 dias desde o login.
  if (Date.now() - row.lastSeenAt.getTime() > 3600_000) {
    const absolute = row.createdAt.getTime() + ABSOLUTE_DAYS * 86400_000
    const next = new Date(Math.min(absolute, Date.now() + SESSION_DAYS * 86400_000))
    await db
      .update(schema.adminSessions)
      .set({ lastSeenAt: new Date(), expiresAt: next })
      .where(eq(schema.adminSessions.id, row.sessionId))
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role, sessionId: row.sessionId }
})

/** Para páginas e ações do painel: exige login (e, opcionalmente, um papel mínimo). */
export async function requireAdmin(min: AdminRole = 'viewer'): Promise<AdminUser> {
  const admin = await getAdmin()
  if (!admin) redirect('/admin/login')
  if (!hasRole(admin, min)) throw new Error('Você não tem permissão para esta ação.')
  return admin
}

export async function destroyAdminSession() {
  const jar = await cookies()
  const token = jar.get(adminCookieName())?.value
  if (token) await db.delete(schema.adminSessions).where(eq(schema.adminSessions.tokenHash, sha256(token)))
  jar.delete(adminCookieName())
}
