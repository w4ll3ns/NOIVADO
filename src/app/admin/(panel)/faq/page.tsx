import type { Metadata } from 'next'
import { asc } from 'drizzle-orm'
import { PageHead } from '@/components/admin/ui'
import { ConfirmSubmit } from '@/components/admin/ClientBits'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { deleteFaqAction, saveFaqAction } from './actions'

export const metadata: Metadata = { title: 'FAQ' }

export default async function FaqAdminPage() {
  const admin = await requireAdmin()
  const canEdit = hasRole(admin, 'editor')
  const faqs = await db.select().from(schema.faqs).orderBy(asc(schema.faqs.sortOrder), asc(schema.faqs.createdAt))
  return (
    <>
      <PageHead
        title="Perguntas frequentes"
        subtitle={
          <>
            As respostas aceitam variáveis como <code className="a-code">{'{{HORARIO_EVENTO}}'}</code>, <code className="a-code">{'{{PRAZO_RSVP}}'}</code> e <code className="a-code">{'{{LOCAL_EVENTO}}'}</code> — elas se
            atualizam sozinhas quando você muda as configurações.
          </>
        }
      />
      <div style={{ display: 'grid', gap: 12 }}>
        {[...faqs, null].map((f) => (
          <section key={f?.id ?? 'new'} className="a-card" style={{ margin: 0 }}>
            <form action={saveFaqAction} className="a-form">
              <input type="hidden" name="id" value={f?.id ?? ''} />
              <div className="a-form-grid" style={{ gridTemplateColumns: '1fr 110px' }}>
                <label className="a-field">
                  <span>{f ? 'Pergunta' : 'Nova pergunta'}</span>
                  <input className="a-input" name="question" defaultValue={f?.question ?? ''} required disabled={!canEdit} />
                </label>
                <label className="a-field">
                  <span>Ordem</span>
                  <input className="a-input" type="number" name="sortOrder" defaultValue={f?.sortOrder ?? faqs.length} disabled={!canEdit} />
                </label>
              </div>
              <label className="a-field">
                <span>Resposta</span>
                <textarea className="a-textarea" name="answer" rows={3} defaultValue={f?.answer ?? ''} required disabled={!canEdit} />
              </label>
              {canEdit ? (
                <div className="a-actions" style={{ alignItems: 'center' }}>
                  <label className="a-check">
                    <input type="checkbox" name="isActive" defaultChecked={f?.isActive ?? true} /> Visível no site
                  </label>
                  <button className="a-btn a-btn--primary">{f ? 'Salvar' : 'Adicionar'}</button>
                </div>
              ) : null}
            </form>
            {f && canEdit ? (
              <form action={deleteFaqAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={f.id} />
                <ConfirmSubmit message="Excluir esta pergunta?">Excluir</ConfirmSubmit>
              </form>
            ) : null}
          </section>
        ))}
      </div>
    </>
  )
}
