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
import { saveScheduleAction, saveSettingsAction } from '../actions'

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
      { name: 'receptionTime', label: 'Horário de recepção', type: 'time', help: 'Só é usado se a Programação estiver vazia: o site mostra o horário do 1º momento da Programação' },
      { name: 'mainTime', label: 'Horário principal', type: 'time', help: 'Idem — usado só sem Programação' },
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
    intro: 'A abertura com o casarão toca sempre que alguém abre (ou recarrega) a página inicial.',
    fields: [
      { name: 'enabled', label: 'Mostrar a abertura com o casarão', type: 'checkbox', span: true },
      { name: 'phrase', label: 'Frase da abertura', type: 'text', span: true },
      { name: 'buttonLabel', label: 'Texto do botão', type: 'text' },
      { name: 'welcomePhrase', label: 'Boas-vindas (visitante)', type: 'text' },
      { name: 'welcomePhraseGuest', label: 'Boas-vindas (convidado reconhecido)', type: 'text', span: true },
      { name: 'namesSizeIntro', label: 'Tamanho do nome do casal na abertura (%)', type: 'number', help: '100 = tamanho original; de 50 a 150' },
      { name: 'namesSizeHome', label: 'Tamanho do nome do casal no convite da página inicial (%)', type: 'number', help: '100 = tamanho original; de 50 a 150' },
      {
        name: 'musicMediaId',
        label: 'Música de fundo',
        type: 'audio',
        help: 'MP3 (ou M4A), até 25 MB. Começa quando o convidado toca em “Entrar” e continua enquanto ele navega pelo site; um botão ♪ no canto pausa.',
      },
      { name: 'musicVolume', label: 'Volume da música (0 a 100)', type: 'number', help: 'No iPhone vale o volume do próprio aparelho.' },
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
    ],
  },
  { slug: 'programacao', label: 'Programação', key: null, fields: [] },
  {
    slug: 'traje',
    label: 'Dress Code',
    key: 'dressCode',
    fields: [
      { name: 'enabled', label: 'Mostrar o Dress Code no site', type: 'checkbox', span: true },
      { name: 'type', label: 'Tipo de traje', type: 'text', help: 'Aparece no botão “Dress Code” da seção Informações' },
      { name: 'description', label: 'Descrição', type: 'text', help: 'Frase em itálico no topo da página do Dress Code' },
      {
        name: 'referenceMediaIds',
        label: 'Imagens do traje',
        type: 'media',
        help: 'Aparecem grandes na página do Dress Code, uma embaixo da outra, na ordem em que foram enviadas.',
      },
      { name: 'showType', label: 'Mostrar o ícone e o tipo de traje no topo da página', type: 'checkbox', span: true },
      { name: 'showColors', label: 'Mostrar as paletas de cores (sugeridas e reservadas)', type: 'checkbox', span: true },
      { name: 'suggestedColors', label: 'Cores sugeridas', type: 'colors' },
      { name: 'reservedColors', label: 'Cores reservadas', type: 'colors' },
      { name: 'reservedNote', label: 'Nota sobre as cores reservadas', type: 'text', span: true },
      { name: 'showRecommendations', label: 'Mostrar as recomendações', type: 'checkbox', span: true },
      { name: 'recommendations', label: 'Recomendações', type: 'textarea', rows: 3 },
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
      {
        name: 'giftsInvite',
        label: 'Convite para a lista de presentes (após responder)',
        type: 'textarea',
        rows: 2,
        help: 'Aparece logo acima do botão “Ver presentes” quando o convidado responde. Deixe em branco para não mostrar.',
      },
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
      {section.slug === 'programacao' ? <ScheduleEditor canEdit={canEdit} /> : null}
    </>
  )
}

async function ScheduleEditor({ canEdit }: { canEdit: boolean }) {
  const items = await db.select().from(schema.scheduleItems).orderBy(asc(schema.scheduleItems.sortOrder), asc(schema.scheduleItems.createdAt))
  return (
    <section className="a-card">
      <h2 className="a-card__title">
        Programação <small>ícone opcional ao lado de cada momento (PNG com fundo transparente) — escolha e clique em Salvar</small>
      </h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {[...items, null].map((s) => (
          <form key={s?.id ?? 'new'} action={saveScheduleAction} className="a-form-grid" style={{ gridTemplateColumns: '110px 1fr 2fr 80px', alignItems: 'end', borderTop: '1px solid var(--a-line)', paddingTop: 10 }}>
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
            <div className="a-field" style={{ gridColumn: '1 / 3' }}>
              <span>Ícone</span>
              <MediaPicker name="iconMediaId" kind="icone" purpose="schedule-icon" initialId={s?.iconMediaId ?? null} disabled={!canEdit} />
            </div>
            {canEdit ? (
              <div className="a-row-actions" style={{ gridColumn: '3 / -1', alignSelf: 'end', justifyContent: 'flex-end' }}>
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
