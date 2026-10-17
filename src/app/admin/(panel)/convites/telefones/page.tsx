import type { Metadata } from 'next'
import Link from 'next/link'
import { and, asc, inArray, isNull, sql } from 'drizzle-orm'
import { PageHead, Tabs } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { noPhoneSql } from '@/lib/admin/invitation-filters'
import { CompletarTelefones, type ConviteSemTelefone } from './CompletarTelefones'

export const metadata: Metadata = { title: 'Completar telefones' }

export default async function TelefonesPage(props: PageProps<'/admin/convites/telefones'>) {
  await requireAdmin('editor')
  const sp = await props.searchParams
  // Padrão: convites sem nenhum telefone (ninguém recebe o link). "pessoas": todo mundo sem número próprio.
  const todasPessoas = sp.mostrar === 'pessoas'
  const i = schema.invitations
  const g = schema.guests
  const semNumero = and(isNull(g.removedAt), sql`not ${g.isCompanion}`, isNull(g.phone))

  const [convites, [contagem]] = await Promise.all([
    db
      .select({ id: i.id, label: i.label })
      .from(i)
      .where(
        and(
          isNull(i.archivedAt),
          todasPessoas
            ? sql`exists (select 1 from guests g where g.invitation_id = ${i.id} and g.removed_at is null and not g.is_companion and g.phone is null)`
            : noPhoneSql(),
        ),
      )
      .orderBy(asc(i.label)),
    db
      .select({
        convites: sql<number>`(count(*) filter (where ${noPhoneSql()}))::int`,
        pessoas: sql<number>`(select count(*)::int from guests g join invitations iv on iv.id = g.invitation_id where iv.archived_at is null and g.removed_at is null and not g.is_companion and g.phone is null)`,
      })
      .from(i)
      .where(isNull(i.archivedAt)),
  ])
  const pessoas = convites.length
    ? await db
        .select({ id: g.id, invitationId: g.invitationId, firstName: g.firstName, lastName: g.lastName })
        .from(g)
        .where(and(inArray(g.invitationId, convites.map((c) => c.id)), semNumero))
        .orderBy(asc(g.sortOrder))
    : []
  const lista: ConviteSemTelefone[] = convites
    .map((c) => ({ ...c, pessoas: pessoas.filter((p) => p.invitationId === c.id).map(({ invitationId: _, ...p }) => p) }))
    .filter((c) => c.pessoas.length)

  return (
    <>
      <PageHead
        title="Completar telefones"
        subtitle="Quem ainda não tem número para receber o link do convite."
        actions={
          <Link href="/admin/convites" className="a-btn">
            Voltar
          </Link>
        }
      />
      <Tabs
        current={todasPessoas ? 'pessoas' : 'convites'}
        items={[
          { key: 'convites', label: 'Convites sem telefone', href: '/admin/convites/telefones', count: contagem?.convites ?? 0 },
          { key: 'pessoas', label: 'Todas as pessoas sem telefone', href: '/admin/convites/telefones?mostrar=pessoas', count: contagem?.pessoas ?? 0 },
        ]}
      />
      <p className="a-help" style={{ margin: '-4px 0 12px' }}>
        {todasPessoas
          ? 'Inclui quem é de um convite que já tem telefone (por exemplo, para mandar o link a cada pessoa da família).'
          : 'Convites em que ninguém tem número: basta um telefone por convite para enviar o link.'}
      </p>
      <CompletarTelefones convites={lista} />
    </>
  )
}
