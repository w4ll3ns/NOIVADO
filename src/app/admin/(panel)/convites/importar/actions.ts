'use server'

import { revalidatePath } from 'next/cache'
import { and, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { buildImport, importSignature, type ImportInvitation } from '@/lib/admin/import'
import { parseCsv, parseXlsx } from '@/lib/spreadsheet'
import { createInvitationToken, logInvitationEvent } from '@/lib/invitations'
import { INVITATION_KINDS } from '@/lib/db/schema'
import { cleanLine } from '@/lib/sanitize'

export type ImportState = {
  preview?: ImportInvitation[]
  /** Índices (em preview) dos convites que já existem e não serão importados de novo. */
  existing?: number[]
  payload?: string
  errors?: string[]
  error?: string
  done?: { created: number; skipped: string[] }
}

/**
 * Quantos convites ativos já existem com cada assinatura (nome, pessoas e telefones): importar a mesma
 * planilha de novo não duplica, mas duas pessoas diferentes com o mesmo nome entram as duas.
 */
async function existingSignatures(labels: string[]) {
  const counts = new Map<string, number>()
  const lower = [...new Set(labels.map((l) => l.toLowerCase()))]
  if (!lower.length) return counts
  const invs = await db
    .select({ id: schema.invitations.id, label: schema.invitations.label, phone: schema.invitations.phone })
    .from(schema.invitations)
    .where(and(isNull(schema.invitations.archivedAt), inArray(sql`lower(${schema.invitations.label})`, lower)))
  if (!invs.length) return counts
  const guests = await db
    .select({ invitationId: schema.guests.invitationId, firstName: schema.guests.firstName, phone: schema.guests.phone })
    .from(schema.guests)
    .where(and(inArray(schema.guests.invitationId, invs.map((i) => i.id)), isNull(schema.guests.removedAt), sql`not ${schema.guests.isCompanion}`))
  for (const inv of invs) {
    const sig = importSignature({ ...inv, guests: guests.filter((g) => g.invitationId === inv.id) })
    counts.set(sig, (counts.get(sig) ?? 0) + 1)
  }
  return counts
}

/** Marca, na ordem da lista, os convites que já existem (consome cada existente uma vez só). */
function markExisting(list: ImportInvitation[], counts: Map<string, number>) {
  const left = new Map(counts)
  return list.map((inv) => {
    const sig = importSignature(inv)
    const n = left.get(sig) ?? 0
    if (n > 0) left.set(sig, n - 1)
    return n > 0
  })
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
  const exists = markExisting(invitations, await existingSignatures(invitations.map((i) => i.label)))
  const existing = exists.flatMap((e, i) => (e ? [i] : []))
  return { preview: invitations, existing, payload: JSON.stringify(invitations), errors }
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
  const exists = markExisting(list, await existingSignatures(list.map((i) => i.label)))
  for (const [index, inv] of list.entries()) {
    if (exists[index]) {
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

export type ExcluirTudoState = { error?: string; done?: { invitations: number; guests: number } }

const CONFIRMACAO_EXCLUIR = 'EXCLUIR TUDO'
const confere = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase() === CONFIRMACAO_EXCLUIR

/**
 * Começar do zero (só o dono): exclui todos os convites — inclusive arquivados —, com as pessoas,
 * links, respostas e histórico, e os grupos. Pagamentos, recados e fotos ficam (sem o vínculo).
 */
export async function excluirTudoAction(_prev: ExcluirTudoState, form: FormData): Promise<ExcluirTudoState> {
  const admin = await requireAdmin('owner')
  if (!confere(form.get('confirmacao'))) return { error: `Para confirmar, digite ${CONFIRMACAO_EXCLUIR}.` }
  const done = await db.transaction(async (tx) => {
    const [{ guests }] = await tx.select({ guests: sql<number>`count(*)::int` }).from(schema.guests)
    const deleted = await tx.delete(schema.invitations).returning({ id: schema.invitations.id })
    await tx.delete(schema.guestGroups)
    return { invitations: deleted.length, guests }
  })
  await audit(admin.id, 'invitation.delete_all', 'invitation', null, done)
  revalidatePath('/admin', 'layout')
  return { done }
}
