'use server'

import { revalidatePath } from 'next/cache'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { buildImport, type ImportInvitation } from '@/lib/admin/import'
import { parseCsv, parseXlsx } from '@/lib/spreadsheet'
import { createInvitationToken, logInvitationEvent } from '@/lib/invitations'
import { INVITATION_KINDS } from '@/lib/db/schema'
import { cleanLine } from '@/lib/sanitize'

export type ImportState = {
  preview?: ImportInvitation[]
  payload?: string
  errors?: string[]
  error?: string
  done?: { created: number; skipped: string[] }
}

export async function previewImportAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  await requireAdmin('editor')
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) return { error: 'Escolha um arquivo .csv ou .xlsx.' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Arquivo muito grande (máx. 5 MB).' }
  const buf = Buffer.from(await file.arrayBuffer())
  let rows: string[][]
  try {
    rows = /\.xlsx$/i.test(file.name) || buf.subarray(0, 2).toString() === 'PK' ? await parseXlsx(buf) : parseCsv(buf.toString('utf8'))
  } catch {
    return { error: 'Não conseguimos ler o arquivo. Use o modelo disponível nesta página.' }
  }
  const { invitations, errors } = buildImport(rows)
  if (!invitations.length) return { error: errors[0] ?? 'Nenhum convidado encontrado.', errors }
  return { preview: invitations, payload: JSON.stringify(invitations), errors }
}

const importSchema = z.array(
  z.object({
    label: z.string().min(1).max(120),
    kind: z.enum(INVITATION_KINDS),
    groupName: z.string().max(80).nullable(),
    phone: z.string().regex(/^\d{10,15}$/).nullable(),
    email: z.string().max(200).nullable(),
    allowCompanions: z.boolean(),
    maxCompanions: z.number().int().min(0).max(10),
    isCloseFamily: z.boolean(),
    notes: z.string().max(2000).nullable(),
    guests: z
      .array(z.object({ firstName: z.string().min(1).max(60), lastName: z.string().max(80).nullable(), phone: z.string().regex(/^\d{10,15}$/).nullable(), email: z.string().max(200).nullable() }))
      .min(1)
      .max(40),
  }),
).max(1000)

export async function confirmImportAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const admin = await requireAdmin('editor')
  let list: z.infer<typeof importSchema>
  try {
    list = importSchema.parse(JSON.parse(String(form.get('payload') ?? '[]')))
  } catch {
    return { error: 'Dados de importação inválidos. Envie o arquivo novamente.' }
  }
  const skipped: string[] = []
  let created = 0
  for (const inv of list) {
    const [exists] = await db.select({ id: schema.invitations.id }).from(schema.invitations).where(sql`lower(${schema.invitations.label}) = lower(${inv.label}) and ${schema.invitations.archivedAt} is null`)
    if (exists) {
      skipped.push(inv.label)
      continue
    }
    await db.transaction(async (tx) => {
      let groupId: string | null = null
      if (inv.groupName) {
        const name = cleanLine(inv.groupName, 80)
        const [g] = await tx.select().from(schema.guestGroups).where(sql`${schema.guestGroups.name} = ${name}`)
        groupId = g?.id ?? (await tx.insert(schema.guestGroups).values({ name }).returning())[0].id
      }
      const [row] = await tx
        .insert(schema.invitations)
        .values({
          label: cleanLine(inv.label, 120),
          kind: inv.kind,
          groupId,
          phone: inv.phone,
          email: inv.email,
          allowCompanions: inv.allowCompanions,
          maxCompanions: inv.allowCompanions ? Math.max(1, inv.maxCompanions) : 0,
          isCloseFamily: inv.isCloseFamily,
          notes: inv.notes,
        })
        .returning()
      await tx.insert(schema.guests).values(
        inv.guests.map((g, i) => ({ invitationId: row.id, firstName: cleanLine(g.firstName, 60), lastName: g.lastName ? cleanLine(g.lastName, 80) : null, phone: g.phone, email: g.email, sortOrder: i })),
      )
      await createInvitationToken(row.id, tx)
      await logInvitationEvent(row.id, 'created', { actor: 'admin', adminId: admin.id, data: { import: true } }, tx)
    })
    created++
  }
  await audit(admin.id, 'invitation.import', 'invitation', null, { created, skipped: skipped.length })
  revalidatePath('/admin/convites')
  return { done: { created, skipped } }
}
