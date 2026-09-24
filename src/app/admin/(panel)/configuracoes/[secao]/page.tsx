import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc } from 'drizzle-orm'
import { PageHead } from '@/components/admin/ui'
import { ConfirmSubmit } from '@/components/admin/ClientBits'
import { MediaPicker } from '@/components/admin/MediaPicker'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import type { SettingsKey } from '@/lib/settings-schema'
import { SettingsForm, type FieldDef } from '../SettingsForm'
import { saveMilestoneAction, saveScheduleAction, saveSettingsAction } from '../actions'

export const metadata: Metadata = { title: 'Configurações' }

type Section = { slug: string; label: string; key: SettingsKey | null; intro?: string; fields: FieldDef[] }

const SECTIONS: Section[] = [
  {
    slug: 'evento',
    label: 'Evento',
    key: 'event',
    intro: 'Dados usados em todo o site, no portal, nas mensagens de WhatsApp e nas perguntas frequentes.',
    fields: [
      { name: 'title', label: 'Evento', type: 'text' },
      { name: 'coupleNames', label: 'Nome do casal', type: 'text', help: 'Use “&” entre os nomes: Maby & Chris' },
      { name: 'date', label: 'Data', type: 'date' },
      { name: 'receptionTime', label: 'Horário de recepção', type: 'time' },
      { name: 'mainTime', label: 'Horário principal', type: 'time' },
      { name: 'venueName', label: 'Local', type: 'text' },
      { name: 'region', label: 'Região', type: 'text' },
      { name: 'address', label: 'Endereço completo', type: 'text', span: true },
      { name: 'googleMapsUrl', label: 'Link do Google Maps (opcional)', type: 'url', help: 'Vazio = busca automática pelo nome + endereço' },
      { name: 'wazeUrl', label: 'Link do Waze (opcional)', type: 'url' },
      { name: 'parking', label: 'Estacionamento', type: 'textarea', rows: 2 },
      { name: 'valet', label: 'Serviço de manobrista', type: 'textarea', rows: 2 },
      { name: 'entrance', label: 'Entrada', type: 'textarea', rows: 2 },
      { name: 'notes', label: 'Observações', type: 'textarea', rows: 2 },
      { name: 'recommendations', label: 'Recomendações especiais', type: 'textarea', rows: 2 },
      { name: 'contactName', label: 'Contato para dúvidas (nome)', type: 'text' },
      { name: 'contactPhone', label: 'WhatsApp para dúvidas', type: 'tel', help: 'Aparece em “Dúvidas” e para quem não encontrou o link' },
    ],
  },
  {
    slug: 'abertura',
    label: 'Abertura e Home',
    key: 'intro',
    intro: 'A abertura com o casarão aparece na primeira visita de cada aparelho.',
    fields: [
      { name: 'enabled', label: 'Mostrar a abertura com o casarão', type: 'checkbox', span: true },
      { name: 'phrase', label: 'Frase da abertura', type: 'text', span: true },
      { name: 'buttonLabel', label: 'Texto do botão', type: 'text' },
      { name: 'welcomePhrase', label: 'Boas-vindas (visitante)', type: 'text' },
      { name: 'welcomePhraseGuest', label: 'Boas-vindas (convidado reconhecido)', type: 'text', span: true },
    ],
  },
  {
    slug: 'home',
    label: 'Contador',
    key: 'home',
    fields: [
      { name: 'countdownText', label: 'Contador', type: 'text', span: true, help: 'Use {{dias}} onde entra o número' },
      { name: 'countdownTodayText', label: 'No dia do evento', type: 'text', span: true },
      { name: 'countdownPastText', label: 'Depois do evento', type: 'text', span: true },
      { name: 'showGiftsButton', label: 'Mostrar “Ver presentes” na home', type: 'checkbox' },
    ],
  },
  {
    slug: 'historia',
    label: 'Nossa História',
    key: 'story',
    fields: [
      { name: 'enabled', label: 'Mostrar a seção Nossa História', type: 'checkbox', span: true },
      { name: 'title', label: 'Título', type: 'text' },
      { name: 'intro', label: 'Texto (uma frase por linha)', type: 'textarea', rows: 5 },
    ],
  },
  { slug: 'programacao', label: 'Programação', key: null, fields: [] },
  {
    slug: 'traje',
    label: 'Dress Code',
    key: 'dressCode',
    fields: [
      { name: 'enabled', label: 'Mostrar a seção Dress Code', type: 'checkbox', span: true },
      { name: 'type', label: 'Tipo de traje', type: 'text' },
      { name: 'description', label: 'Descrição', type: 'text' },
      { name: 'suggestedColors', label: 'Cores sugeridas', type: 'colors' },
      { name: 'reservedColors', label: 'Cores reservadas', type: 'colors' },
      { name: 'reservedNote', label: 'Nota sobre as cores reservadas', type: 'text', span: true },
      { name: 'recommendations', label: 'Recomendações', type: 'textarea', rows: 3 },
      { name: 'referenceMediaIds', label: 'Imagens de referência', type: 'media' },
    ],
  },
  {
    slug: 'rsvp',
    label: 'Confirmação (RSVP)',
    key: 'rsvp',
    fields: [
      { name: 'deadline', label: 'Prazo para confirmar/alterar', type: 'date', help: 'Depois desta data o convidado vê a confirmação, mas não altera' },
      { name: 'intro', label: 'Texto de abertura', type: 'text', span: true },
      { name: 'askDietary', label: 'Perguntar restrição alimentar', type: 'checkbox' },
      { name: 'askSpecialNeeds', label: 'Perguntar necessidade especial', type: 'checkbox' },
      { name: 'askNotes', label: 'Campo de observações', type: 'checkbox' },
      { name: 'askSong', label: 'Perguntar música desejada', type: 'checkbox' },
      { name: 'askMessage', label: 'Mensagem aos noivos', type: 'checkbox' },
      { name: 'confirmedText', label: 'Texto após confirmar', type: 'textarea', rows: 2 },
      { name: 'declinedText', label: 'Texto após recusar', type: 'textarea', rows: 2 },
      { name: 'closedText', label: 'Texto após o prazo', type: 'textarea', rows: 2 },
    ],
  },
  {
    slug: 'presentes',
    label: 'Presentes',
    key: 'gifts',
    fields: [
      { name: 'enabled', label: 'Lista de presentes ativa', type: 'checkbox', span: true },
      { name: 'intro', label: 'Introdução da lista', type: 'textarea', rows: 4 },
      { name: 'maxInstallments', label: 'Máximo de parcelas no cartão', type: 'number' },
      { name: 'statementDescriptor', label: 'Nome na fatura do cartão (até 13 caracteres)', type: 'text' },
      { name: 'thanksTitle', label: 'Agradecimento — título', type: 'text', span: true },
      { name: 'thanksText', label: 'Agradecimento — texto', type: 'textarea', rows: 3 },
    ],
  },
  {
    slug: 'mensagens',
    label: 'Livro de mensagens',
    key: 'guestbook',
    fields: [
      { name: 'enabled', label: 'Livro de mensagens ativo', type: 'checkbox', span: true },
      { name: 'title', label: 'Título', type: 'text', span: true },
      { name: 'intro', label: 'Texto', type: 'textarea', rows: 3 },
    ],
  },
  {
    slug: 'privacidade',
    label: 'Privacidade',
    key: 'privacy',
    intro: 'Informações do aviso de privacidade (LGPD).',
    fields: [
      { name: 'controllerName', label: 'Responsáveis pelos dados', type: 'text' },
      { name: 'contactEmail', label: 'E-mail para pedidos sobre dados', type: 'email' },
      { name: 'extra', label: 'Texto adicional', type: 'textarea', rows: 4 },
    ],
  },
]

export default async function SettingsSectionPage(props: PageProps<'/admin/configuracoes/[secao]'>) {
  const admin = await requireAdmin()
  const { secao } = await props.params
  const section = SECTIONS.find((s) => s.slug === secao)
  if (!section) notFound()
  const settings = await getSettings()
  const canEdit = hasRole(admin, 'editor')

  return (
    <>
      <PageHead title="Configurações" subtitle={section.intro ?? 'Tudo o que aparece no site pode ser ajustado aqui.'} />
      <nav className="a-subnav" aria-label="Seções">
        {SECTIONS.map((s) => (
          <Link key={s.slug} href={`/admin/configuracoes/${s.slug}`} aria-current={s.slug === section.slug ? 'page' : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>
      {section.key ? (
        <SettingsForm
          action={saveSettingsAction.bind(null, section.key)}
          fields={section.fields}
          values={settings[section.key] as Record<string, unknown>}
          readOnly={!canEdit}
        />
      ) : null}
      {section.slug === 'historia' ? <StoryEditor canEdit={canEdit} /> : null}
      {section.slug === 'programacao' ? <ScheduleEditor canEdit={canEdit} /> : null}
    </>
  )
}

async function StoryEditor({ canEdit }: { canEdit: boolean }) {
  const items = await db.select().from(schema.storyMilestones).orderBy(asc(schema.storyMilestones.sortOrder), asc(schema.storyMilestones.createdAt))
  return (
    <section className="a-card" style={{ marginTop: 16 }}>
      <h2 className="a-card__title">
        Linha do tempo <small>pequenos acontecimentos, com data e foto opcionais</small>
      </h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {[...items, null].map((m) => (
          <form key={m?.id ?? 'new'} action={saveMilestoneAction} className="a-form-grid" style={{ borderTop: '1px solid var(--a-line)', paddingTop: 12 }}>
            <input type="hidden" name="id" value={m?.id ?? ''} />
            <label className="a-field">
              <span>{m ? 'Data / marco' : 'Novo acontecimento — data / marco'}</span>
              <input className="a-input" name="dateLabel" defaultValue={m?.dateLabel ?? ''} placeholder="Março de 2019" disabled={!canEdit} />
            </label>
            <label className="a-field">
              <span>Título</span>
              <input className="a-input" name="title" defaultValue={m?.title ?? ''} required disabled={!canEdit} />
            </label>
            <label className="a-field span-2">
              <span>Texto curto</span>
              <textarea className="a-textarea" name="text" rows={2} defaultValue={m?.text ?? ''} disabled={!canEdit} />
            </label>
            <div className="a-field">
              <span>Foto (opcional)</span>
              <MediaPicker name="mediaId" initialId={m?.mediaId ?? null} disabled={!canEdit} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
              <label className="a-field" style={{ width: 90 }}>
                <span>Ordem</span>
                <input className="a-input" type="number" name="sortOrder" defaultValue={m?.sortOrder ?? items.length} disabled={!canEdit} />
              </label>
              <label className="a-check">
                <input type="checkbox" name="isActive" defaultChecked={m?.isActive ?? true} disabled={!canEdit} /> Visível
              </label>
              {canEdit ? <button className="a-btn a-btn--primary a-btn--sm">{m ? 'Salvar' : 'Adicionar'}</button> : null}
              {m && canEdit ? (
                <ConfirmSubmit message="Excluir este acontecimento?" name="op" value="delete">
                  Excluir
                </ConfirmSubmit>
              ) : null}
            </div>
          </form>
        ))}
      </div>
    </section>
  )
}

async function ScheduleEditor({ canEdit }: { canEdit: boolean }) {
  const items = await db.select().from(schema.scheduleItems).orderBy(asc(schema.scheduleItems.sortOrder), asc(schema.scheduleItems.createdAt))
  return (
    <section className="a-card">
      <h2 className="a-card__title">Programação</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {[...items, null].map((s) => (
          <form key={s?.id ?? 'new'} action={saveScheduleAction} className="a-form-grid" style={{ gridTemplateColumns: '110px 1fr 2fr 80px auto', alignItems: 'end', borderTop: '1px solid var(--a-line)', paddingTop: 10 }}>
            <input type="hidden" name="id" value={s?.id ?? ''} />
            <label className="a-field">
              <span>Horário</span>
              <input className="a-input" name="timeLabel" defaultValue={s?.timeLabel ?? ''} placeholder="19h30" required disabled={!canEdit} />
            </label>
            <label className="a-field">
              <span>{s ? 'Momento' : 'Novo momento'}</span>
              <input className="a-input" name="title" defaultValue={s?.title ?? ''} required disabled={!canEdit} />
            </label>
            <label className="a-field">
              <span>Descrição</span>
              <input className="a-input" name="description" defaultValue={s?.description ?? ''} disabled={!canEdit} />
            </label>
            <label className="a-field">
              <span>Ordem</span>
              <input className="a-input" type="number" name="sortOrder" defaultValue={s?.sortOrder ?? items.length} disabled={!canEdit} />
            </label>
            {canEdit ? (
              <div className="a-row-actions">
                <label className="a-check">
                  <input type="checkbox" name="isActive" defaultChecked={s?.isActive ?? true} /> Visível
                </label>
                <button className="a-btn a-btn--primary a-btn--sm">{s ? 'Salvar' : 'Adicionar'}</button>
                {s ? (
                  <ConfirmSubmit message="Excluir este item?" name="op" value="delete">
                    Excluir
                  </ConfirmSubmit>
                ) : null}
              </div>
            ) : null}
          </form>
        ))}
      </div>
    </section>
  )
}
