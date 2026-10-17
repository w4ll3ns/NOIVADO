import type { Metadata } from 'next'
import Link from 'next/link'
import { sql } from 'drizzle-orm'
import { PageHead } from '@/components/admin/ui'
import { hasRole, requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { ImportForm } from './ImportForm'
import { ExcluirTudo, type ResumoExclusao } from './ExcluirTudo'

export const metadata: Metadata = { title: 'Importar convidados' }

/** O que "Começar do zero" apagaria (todos os convites, inclusive arquivados). */
async function resumoExclusao(): Promise<ResumoExclusao> {
  const i = schema.invitations
  const [[conv], [pes]] = await Promise.all([
    db
      .select({
        convites: sql<number>`count(*)::int`,
        enviados: sql<number>`(count(*) filter (where ${i.sentAt} is not null))::int`,
        respondidos: sql<number>`(count(*) filter (where ${i.rsvpStatus} <> 'pending'))::int`,
        arquivados: sql<number>`(count(*) filter (where ${i.archivedAt} is not null))::int`,
      })
      .from(i),
    db.select({ pessoas: sql<number>`count(*)::int` }).from(schema.guests),
  ])
  return { ...conv, pessoas: pes.pessoas }
}

export default async function ImportPage() {
  const admin = await requireAdmin('editor')
  const dono = hasRole(admin, 'owner')
  return (
    <>
      <PageHead title="Importar convidados" subtitle="Planilha Excel ou CSV. Nada é gravado antes da sua confirmação." actions={<Link href="/admin/convites" className="a-btn">Voltar</Link>} />
      <ImportForm />
      {dono ? <ExcluirTudo resumo={await resumoExclusao()} /> : null}
    </>
  )
}
