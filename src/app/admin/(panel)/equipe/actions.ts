'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password'
import { audit } from '@/lib/audit'
import { cleanLine, isEmail } from '@/lib/sanitize'
import { ADMIN_ROLES, type AdminRole } from '@/lib/db/schema'

export type TeamState = { ok?: string; error?: string }

export async function createAdminAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const owner = await requireAdmin('owner')
  const email = cleanLine(form.get('email'), 200).toLowerCase()
  const name = cleanLine(form.get('name'), 80)
  const role = String(form.get('role'))
  const password = String(form.get('password') ?? '')
  if (!isEmail(email)) return { error: 'E-mail inválido.' }
  if (!name) return { error: 'Informe o nome.' }
  if (!(ADMIN_ROLES as readonly string[]).includes(role)) return { error: 'Papel inválido.' }
  const weak = validatePasswordStrength(password)
  if (weak) return { error: weak }
  const [exists] = await db.select().from(schema.admins).where(eq(schema.admins.email, email))
  if (exists) return { error: 'Já existe um acesso com este e-mail.' }
  const [row] = await db.insert(schema.admins).values({ email, name, role: role as AdminRole, passwordHash: await hashPassword(password) }).returning()
  await audit(owner.id, 'admin.create', 'admin', row.id, { email, role })
  revalidatePath('/admin/equipe')
  return { ok: `Acesso criado para ${email}. Compartilhe a senha por um canal seguro.` }
}

export async function updateAdminAction(form: FormData) {
  const owner = await requireAdmin('owner')
  const id = String(form.get('id'))
  if (id === owner.id) return
  const op = String(form.get('op'))
  if (op === 'disable' || op === 'enable') {
    await db.update(schema.admins).set({ disabledAt: op === 'disable' ? new Date() : null, updatedAt: new Date() }).where(eq(schema.admins.id, id))
    if (op === 'disable') await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, id))
  } else if (op === 'role') {
    const role = String(form.get('role'))
    if ((ADMIN_ROLES as readonly string[]).includes(role)) await db.update(schema.admins).set({ role: role as AdminRole, updatedAt: new Date() }).where(eq(schema.admins.id, id))
  }
  await audit(owner.id, `admin.${op}`, 'admin', id)
  revalidatePath('/admin/equipe')
}

export async function changePasswordAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const admin = await requireAdmin()
  const current = String(form.get('current') ?? '')
  const next = String(form.get('next') ?? '')
  const [row] = await db.select().from(schema.admins).where(eq(schema.admins.id, admin.id))
  if (!row || !(await verifyPassword(current, row.passwordHash))) return { error: 'Senha atual incorreta.' }
  const weak = validatePasswordStrength(next)
  if (weak) return { error: weak }
  if (next !== String(form.get('confirm') ?? '')) return { error: 'A confirmação não confere.' }
  await db.update(schema.admins).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(schema.admins.id, admin.id))
  // Encerra as outras sessões deste usuário.
  await db.delete(schema.adminSessions).where(and(eq(schema.adminSessions.adminId, admin.id), ne(schema.adminSessions.id, admin.sessionId)))
  await audit(admin.id, 'admin.change_password', 'admin', admin.id)
  return { ok: 'Senha alterada. As outras sessões foram encerradas.' }
}
