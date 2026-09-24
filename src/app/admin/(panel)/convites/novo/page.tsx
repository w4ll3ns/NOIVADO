import type { Metadata } from 'next'
import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { PageHead } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { InvitationForm } from '../InvitationForm'
import { saveInvitationAction } from '../actions'

export const metadata: Metadata = { title: 'Novo convite' }

export default async function NewInvitationPage() {
  await requireAdmin('editor')
  const [templates, groups] = await Promise.all([
    db.select({ id: schema.whatsappTemplates.id, name: schema.whatsappTemplates.name }).from(schema.whatsappTemplates).orderBy(asc(schema.whatsappTemplates.name)),
    db.select({ name: schema.guestGroups.name }).from(schema.guestGroups).orderBy(asc(schema.guestGroups.name)),
  ])
  return (
    <>
      <PageHead title="Novo convite" subtitle="Um convite = um link único. Pode representar uma pessoa, um casal, uma família ou um grupo." actions={<Link href="/admin/convites" className="a-btn">Voltar</Link>} />
      <InvitationForm
        action={saveInvitationAction.bind(null, null)}
        isNew
        templates={templates}
        groups={groups.map((g) => g.name)}
        initial={{ label: '', greetingName: '', kind: 'individual', groupName: '', isCloseFamily: false, phone: '', email: '', allowCompanions: false, maxCompanions: 0, whatsappTemplateId: '', notes: '', guests: [] }}
      />
    </>
  )
}
