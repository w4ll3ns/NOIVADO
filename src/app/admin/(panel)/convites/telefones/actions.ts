'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { logInvitationEvent } from '@/lib/invitations'
import { normalizePhone } from '@/lib/format'
import { cleanLine } from '@/lib/sanitize'

export type TelefoneState = { error?: string; salvo?: string }

/** Grava o telefone de uma pessoa; se o convite ainda não tinha telefone, passa a usar este. */
export async function salvarTelefoneAction(guestId: string, _prev: TelefoneState, form: FormData): Promise<TelefoneState> {
  const admin = await requireAdmin('editor')
  const phone = normalizePhone(cleanLine(form.get('telefone'), 40))
  if (!phone) return { error: 'Confira o número, com DDD.' }
  const [g] = await db
    .select({ invitationId: schema.guests.invitationId, firstName: schema.guests.firstName })
    .from(schema.guests)
    .where(and(eq(schema.guests.id, guestId), isNull(schema.guests.removedAt)))
  if (!g) return { error: 'Esta pessoa não está mais na lista. Recarregue a página.' }
  await db.transaction(async (tx) => {
    await tx.update(schema.guests).set({ phone }).where(eq(schema.guests.id, guestId))
    await tx
      .update(schema.invitations)
      .set({ phone, updatedAt: new Date() })
      .where(and(eq(schema.invitations.id, g.invitationId), isNull(schema.invitations.phone)))
    await logInvitationEvent(g.invitationId, 'updated', { actor: 'admin', adminId: admin.id, data: { telefone: g.firstName } }, tx)
  })
  // Sem revalidatePath: a pessoa continua na tela com "Salvo ✓" (sem a lista pular); as páginas do
  // painel são dinâmicas e já vêm atualizadas na próxima visita.
  return { salvo: phone }
}
