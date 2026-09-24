import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge, PageHead, Tabs } from '@/components/admin/ui'
import { ConfirmSubmit } from '@/components/admin/ClientBits'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { loadInvitationRows, toWaInvitation, whatsappContext } from '@/lib/admin/invitations'
import { TEMPLATE_KIND_LABEL } from '@/lib/admin/labels'
import { WHATSAPP_TEMPLATE_KINDS } from '@/lib/db/schema'
import { renderTemplate, unknownVariables } from '@/lib/templates'
import { whatsappOpenedAction } from '../convites/actions'
import { deleteTemplateAction, saveTemplateAction } from './actions'
import { SendQueue } from './SendQueue'

export const metadata: Metadata = { title: 'WhatsApp' }

const VARS: [string, string][] = [
  ['{{NOME_CONVIDADO}}', 'Como o convite é saudado (ex.: João e Maria)'],
  ['{{NOME_GRUPO}}', 'Nome do convite (ex.: Família Silva)'],
  ['{{LINK_CONVITE}}', 'Link único do convite'],
  ['{{NOME_CASAL}}', 'Nome do casal'],
  ['{{DATA_EVENTO}}', 'Data por extenso'],
  ['{{HORARIO_EVENTO}}', 'Horário (recepção)'],
  ['{{LOCAL_EVENTO}}', 'Nome do local'],
  ['{{ENDERECO_EVENTO}}', 'Endereço'],
  ['{{PRAZO_RSVP}}', 'Prazo para confirmar'],
]

export default async function WhatsappPage(props: PageProps<'/admin/whatsapp'>) {
  const admin = await requireAdmin()
  const sp = await props.searchParams
  const queue = sp.fila === 'lembretes' ? 'lembretes' : 'nao-enviados'
  const [wa, queueRows] = await Promise.all([
    whatsappContext(),
    loadInvitationRows({ filter: queue === 'lembretes' ? 'acessaram-nao-confirmaram' : 'nao-enviados' }),
  ])
  const canEdit = hasRole(admin, 'editor')
  const sample = { ...wa.eventValues, NOME_CONVIDADO: 'João e Maria', NOME_GRUPO: 'Família Silva', LINK_CONVITE: 'https://seu-dominio.com/i/7Km2xQ9PaB3c' }

  return (
    <>
      <PageHead
        title="Mensagens do WhatsApp"
        subtitle="Nada é enviado automaticamente: o WhatsApp abre com a mensagem pronta e você toca em enviar."
      />

      <section className="a-card" id="fila">
        <h2 className="a-card__title">Envio em sequência</h2>
        <Tabs
          current={queue}
          items={[
            { key: 'nao-enviados', label: 'Convites não enviados', href: '/admin/whatsapp?fila=nao-enviados#fila' },
            { key: 'lembretes', label: 'Lembretes: acessaram e não confirmaram', href: '/admin/whatsapp?fila=lembretes#fila' },
          ]}
        />
        {canEdit ? (
          <SendQueue
            items={queueRows.filter((r) => r.link).map(toWaInvitation)}
            templates={wa.templates}
            eventValues={wa.eventValues}
            mode={queue === 'lembretes' ? 'reminder' : 'invite'}
            onOpened={whatsappOpenedAction}
          />
        ) : (
          <p className="a-muted">Somente leitura.</p>
        )}
      </section>

      <div className="a-grid a-grid--main" style={{ marginTop: 16 }}>
        <div>
          {[...wa.templates, null].map((t) => {
            const unknown = t ? unknownVariables(t.body) : []
            return (
              <section key={t?.id ?? 'new'} className="a-card">
                <h2 className="a-card__title">
                  {t ? t.name : 'Novo modelo'}
                  {t ? <small>{TEMPLATE_KIND_LABEL[t.kind]}</small> : null}
                </h2>
                <form action={saveTemplateAction} className="a-form">
                  <input type="hidden" name="id" value={t?.id ?? ''} />
                  <div className="a-form-grid">
                    <label className="a-field">
                      <span>Nome</span>
                      <input className="a-input" name="name" defaultValue={t?.name ?? ''} required disabled={!canEdit} />
                    </label>
                    <label className="a-field">
                      <span>Tipo</span>
                      <select className="a-select" name="kind" defaultValue={t?.kind ?? 'custom'} disabled={!canEdit}>
                        {WHATSAPP_TEMPLATE_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {TEMPLATE_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="a-field">
                    <span>Mensagem</span>
                    <textarea className="a-textarea a-textarea--mono" name="body" rows={t ? 10 : 6} defaultValue={t?.body ?? ''} required disabled={!canEdit} />
                  </label>
                  {unknown.length ? <p className="a-alert a-alert--warn">Variáveis desconhecidas: {unknown.join(', ')}</p> : null}
                  {t ? (
                    <details>
                      <summary className="a-help" style={{ cursor: 'pointer' }}>
                        Pré-visualizar com um exemplo
                      </summary>
                      <div className="a-wa-preview" style={{ marginTop: 8 }}>
                        {renderTemplate(t.body, sample)}
                      </div>
                    </details>
                  ) : null}
                  {canEdit ? (
                    <div className="a-actions" style={{ alignItems: 'center' }}>
                      <label className="a-check">
                        <input type="checkbox" name="isDefault" defaultChecked={t?.isDefault ?? false} /> Modelo padrão deste tipo
                      </label>
                      <button className="a-btn a-btn--primary">{t ? 'Salvar' : 'Criar modelo'}</button>
                      {t?.isDefault ? <Badge tone="ok">Padrão</Badge> : null}
                    </div>
                  ) : null}
                </form>
                {t && canEdit ? (
                  <form action={deleteTemplateAction} style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={t.id} />
                    <ConfirmSubmit message={`Excluir o modelo “${t.name}”?`}>Excluir modelo</ConfirmSubmit>
                  </form>
                ) : null}
              </section>
            )
          })}
        </div>
        <aside>
          <section className="a-card" style={{ position: 'sticky', top: 16 }}>
            <h2 className="a-card__title">Variáveis</h2>
            <ul className="a-list-plain">
              {VARS.map(([v, d]) => (
                <li key={v}>
                  <code className="a-code">{v}</code>
                  <div className="a-muted">{d}</div>
                </li>
              ))}
            </ul>
            <p className="a-help" style={{ marginTop: 10 }}>
              O modelo usado em cada convite é escolhido automaticamente pelo tipo (individual, casal, família, familiares próximos) e pode ser trocado na hora do envio. Para quem acessou e não confirmou, o padrão é o
              lembrete. Veja também <Link href="/admin/convites?filtro=acessaram-nao-confirmaram">quem precisa de lembrete</Link>.
            </p>
          </section>
        </aside>
      </div>
    </>
  )
}
