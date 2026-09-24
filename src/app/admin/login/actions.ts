'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { createAdminSession, destroyAdminSession, getAdmin } from '@/lib/auth/session'
import { DUMMY_HASH, verifyPassword } from '@/lib/auth/password'
import { audit } from '@/lib/audit'
import { clientIp, hashIp } from '@/lib/request'
import { rateLimit, resetRateLimit } from '@/lib/security/rate-limit'
import { cleanLine } from '@/lib/sanitize'

export type LoginState = { error?: string; email?: string }

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = cleanLine(form.get('email'), 200).toLowerCase()
  const password = String(form.get('password') ?? '').slice(0, 300)
  const next = String(form.get('next') ?? '')
  const ipKey = `login-ip:${hashIp(await clientIp())}`
  const emailKey = `login-email:${email}`

  // Proteção contra força bruta: por IP e por e-mail.
  const [ipOk, emailOk] = await Promise.all([rateLimit(ipKey, 20, 15 * 60), rateLimit(emailKey, 8, 15 * 60)])
  if (!ipOk || !emailOk) {
    return { error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.', email }
  }

  const [admin] = email ? await db.select().from(schema.admins).where(eq(schema.admins.email, email)) : []
  // Sempre executa o hash (mesmo sem usuário) para não revelar quais e-mails existem.
  const valid = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH)
  if (!admin || !valid || admin.disabledAt) {
    await audit(admin?.id ?? null, 'login_failed', 'admin', admin?.id ?? null, { email })
    return { error: 'E-mail ou senha incorretos.', email }
  }

  await createAdminSession(admin.id)
  await db.update(schema.admins).set({ lastLoginAt: new Date() }).where(eq(schema.admins.id, admin.id))
  await resetRateLimit(emailKey)
  await audit(admin.id, 'login', 'admin', admin.id)
  redirect(next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin')
}

export async function logoutAction() {
  const admin = await getAdmin()
  await destroyAdminSession()
  if (admin) await audit(admin.id, 'logout', 'admin', admin.id)
  redirect('/admin/login')
}
