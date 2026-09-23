/**
 * Cria (ou redefine a senha de) um administrador.
 *
 *   npm run admin:create -- email@exemplo.com "Nome" owner
 * A senha é pedida no terminal (ou lida de ADMIN_PASSWORD).
 */
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createInterface } from 'node:readline/promises'
import * as schema from '../src/lib/db/schema'
import { hashPassword, validatePasswordStrength } from '../src/lib/auth/password'

async function main() {
  const [emailArg, nameArg, roleArg] = process.argv.slice(2)
  const email = emailArg?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('Uso: npm run admin:create -- email@exemplo.com "Nome" [owner|editor|viewer]')
    process.exit(1)
  }
  const role = (schema.ADMIN_ROLES as readonly string[]).includes(roleArg) ? (roleArg as schema.AdminRole) : 'owner'
  let password = process.env.ADMIN_PASSWORD
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    password = await rl.question('Senha (mín. 10 caracteres, letras e números): ')
    rl.close()
  }
  const problem = validatePasswordStrength(password)
  if (problem) {
    console.error(problem)
    process.exit(1)
  }
  const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
  const db = drizzle(client, { schema })
  const passwordHash = await hashPassword(password)
  const [existing] = await db.select().from(schema.admins).where(eq(schema.admins.email, email))
  if (existing) {
    await db
      .update(schema.admins)
      .set({ passwordHash, role, disabledAt: null, updatedAt: new Date() })
      .where(eq(schema.admins.id, existing.id))
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, existing.id))
    console.log(`✓ Senha redefinida para ${email} (${role})`)
  } else {
    await db.insert(schema.admins).values({ email, name: nameArg || email.split('@')[0], passwordHash, role })
    console.log(`✓ Administrador ${email} criado (${role})`)
  }
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
