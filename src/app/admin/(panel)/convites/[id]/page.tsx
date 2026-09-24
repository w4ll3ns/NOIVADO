import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { AccessBadge, Badge, PageHead, PaymentBadge, RsvpBadge, SentBadge } from '@/components/admin/ui'
import { ConfirmSubmit, CopyButton } from '@/components/admin/ClientBits'
import { WhatsAppProvider, WhatsAppTrigger } from '@/components/admin/WhatsAppDialog'
import { requireAdmin, hasRole } from '@/lib/auth/session'
import { db, schema } from '@/lib/db'
import { loadInvitationRows, toWaInvitation, whatsappContext } from '@/lib/admin/invitations'
import { eventLabel } from '@/lib/admin/labels'
import { formatBRL, formatDateTime, formatDateTimeCompact, formatPhone } from '@/lib/format'
import { InvitationForm } from '../InvitationForm'
import {
  archiveInvitationAction,
  markSentAction,
  markSentFormAction,
  regenerateTokenAction,
  saveInvitationAction,
  unmarkSentAction,
  whatsappOpenedAction,
} from '../actions'

export const metadata: Metadata = { title: 'Convite' }

export default async function InvitationDetailPage(props: PageProps<'/admin/convites/[id]'>) {
  const admin = await requireAdmin()
  const { id } = await props.params
  const sp = await props.searchParams
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.id, id))
  if (!inv) notFound()
  const canEdit = hasRole(admin, 'editor')

  const [row] = (await loadInvitationRows({ archived: !!inv.archivedAt })).filter((r) => r.inv.id === id)
  const [events, rsvps, payments, messages, photos, templates, groups, wa] = await Promise.all([
    db.select().from(schema.invitationEvents).where(eq(schema.invitationEvents.invitationId, id)).orderBy(desc(schema.invitationEvents.createdAt)),
    db.select().from(schema.rsvps).where(eq(schema.rsvps.invitationId, id)).orderBy(desc(schema.rsvps.createdAt)),
    db.select().from(schema.giftPayments).where(eq(schema.giftPayments.invitationId, id)).orderBy(desc(schema.giftPayments.createdAt)),
    db.select().from(schema.messages).where(and(eq(schema.messages.invitationId, id), isNull(schema.messages.archivedAt))).orderBy(desc(schema.messages.createdAt)),
    db.select({ id: schema.photos.id, status: schema.photos.status }).from(schema.photos).where(eq(schema.photos.invitationId, id)),
    db.select({ id: schema.whatsappTemplates.id, name: schema.whatsappTemplates.name }).from(schema.whatsappTemplates).orderBy(asc(schema.whatsappTemplates.name)),
    db.select({ name: schema.guestGroups.name, id: schema.guestGroups.id }).from(schema.guestGroups).orderBy(asc(schema.guestGroups.name)),
    whatsappContext(),
  ])
  const rsvpGuests = rsvps.length
    ? await db.select().from(schema.rsvpGuests).where(inArray(schema.rsvpGuests.rsvpId, rsvps.map((r) => r.id)))
    : []
  const allGuests = await db.select().from(schema.guests).where(and(eq(schema.guests.invitationId, id), isNull(schema.guests.removedAt))).orderBy(asc(schema.guests.isCompanion), asc(schema.guests.sortOrder))
  const groupName = groups.find((g) => g.id === inv.groupId)?.name ?? ''
  const reminder = !!inv.firstAccessedAt && inv.rsvpStatus === 'pending'
  const latest = rsvps[0]

  return (
    <WhatsAppProvider templates={wa.templates} eventValues={wa.eventValues} onOpened={whatsappOpenedAction} onMarkSent={markSentAction}>
      <PageHead
        title={inv.label}
        subtitle={
          <>
            <SentBadge sentAt={inv.sentAt} /> <AccessBadge firstAccessedAt={inv.firstAccessedAt} lastAccessedAt={inv.lastAccessedAt} count={inv.accessCount} /> <RsvpBadge status={inv.rsvpStatus} />
            {inv.archivedAt ? <Badge tone="bad">Arquivado</Badge> : null}
          </>
        }
        actions={
          <>
            <Link href="/admin/convites" className="a-btn">
              Voltar
            </Link>
            {canEdit && row?.link ? <WhatsAppTrigger invitation={toWaInvitation(row)} mode={reminder ? 'reminder' : 'invite'} label={reminder ? 'Enviar lembrete' : 'Enviar no WhatsApp'} className="a-btn a-btn--wa" /> : null}
          </>
        }
      />
      {sp.salvo === '1' ? <p className="a-alert a-alert--ok" style={{ marginBottom: 16 }}>Convite salvo.</p> : null}

      <div className="a-grid a-grid--main">
        <div>
          <InvitationForm
            action={saveInvitationAction.bind(null, id)}
            isNew={false}
            readOnly={!canEdit}
            templates={templates}
            groups={groups.map((g) => g.name)}
            initial={{
              label: inv.label,
              greetingName: inv.greetingName ?? '',
              kind: inv.kind,
              groupName,
              isCloseFamily: inv.isCloseFamily,
              phone: inv.phone ? formatPhone(inv.phone) : '',
              email: inv.email ?? '',
              allowCompanions: inv.allowCompanions,
              maxCompanions: inv.maxCompanions,
              whatsappTemplateId: inv.whatsappTemplateId ?? '',
              notes: inv.notes ?? '',
              guests: allGuests.map((g) => ({
                id: g.id,
                firstName: g.firstName,
                lastName: g.lastName ?? '',
                phone: g.phone ? formatPhone(g.phone) : '',
                email: g.email ?? '',
                isChild: g.isChild,
                isCompanion: g.isCompanion,
                attendance: g.attendance,
              })),
            }}
          />

          <section className="a-card" style={{ marginTop: 16 }} id="rsvp">
            <h2 className="a-card__title">
              Respostas (RSVP) <small>{rsvps.length} registro(s) — o histórico nunca é apagado</small>
            </h2>
            {latest ? (
              <dl className="a-form-grid" style={{ margin: '0 0 14px' }}>
                {latest.dietaryRestrictions ? <div><dt className="a-label">Restrição alimentar</dt><dd style={{ margin: 0 }}>{latest.dietaryRestrictions}</dd></div> : null}
                {latest.specialNeeds ? <div><dt className="a-label">Necessidade especial</dt><dd style={{ margin: 0 }}>{latest.specialNeeds}</dd></div> : null}
                {latest.songRequest ? <div><dt className="a-label">Música</dt><dd style={{ margin: 0 }}>{latest.songRequest}</dd></div> : null}
                {latest.notes ? <div><dt className="a-label">Observações</dt><dd style={{ margin: 0 }}>{latest.notes}</dd></div> : null}
              </dl>
            ) : (
              <p className="a-muted">Ainda sem resposta.</p>
            )}
            <ul className="a-list-plain">
              {rsvps.map((r) => (
                <li key={r.id}>
                  <strong>{formatDateTime(r.createdAt)}</strong> · <RsvpBadge status={r.status} /> {r.isChange ? <Badge>Alteração</Badge> : <Badge tone="accent">Primeira resposta</Badge>}
                  <div className="a-muted" style={{ marginTop: 4 }}>
                    {rsvpGuests
                      .filter((g) => g.rsvpId === r.id)
                      .map((g) => `${g.attending ? '✓' : '✕'} ${g.guestName}${g.isCompanion ? ' (acomp.)' : ''}`)
                      .join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div>
          <section className="a-card">
            <h2 className="a-card__title">Link do convite</h2>
            {row?.link ? (
              <>
                <p className="a-code">{row.link}</p>
                <div className="a-actions" style={{ marginTop: 10 }}>
                  <CopyButton text={row.link} label="Copiar link" />
                  <a className="a-btn a-btn--sm" href={`/i/${row.token}?preview=1`} target="_blank" rel="noreferrer">
                    Ver portal
                  </a>
                  {canEdit ? (
                    <form action={regenerateTokenAction}>
                      <input type="hidden" name="id" value={id} />
                      <ConfirmSubmit message="Gerar um novo link? O link atual deixará de funcionar." className="a-btn a-btn--sm">
                        Gerar novo link
                      </ConfirmSubmit>
                    </form>
                  ) : null}
                </div>
              </>
            ) : null}
            <p className="a-help" style={{ marginTop: 10 }}>
              Acessos: {inv.accessCount} · primeiro {formatDateTimeCompact(inv.firstAccessedAt)} · último {formatDateTimeCompact(inv.lastAccessedAt)}.
              Registramos que o link foi acessado — não é possível afirmar quem o abriu, pois ele pode ser encaminhado.
            </p>
            {canEdit ? (
              <div className="a-actions" style={{ marginTop: 10 }}>
                {inv.sentAt ? (
                  <form action={unmarkSentAction}>
                    <input type="hidden" name="id" value={id} />
                    <button className="a-btn a-btn--sm">Desmarcar envio</button>
                  </form>
                ) : (
                  <form action={markSentFormAction}>
                    <input type="hidden" name="id" value={id} />
                    <button className="a-btn a-btn--sm">Marcar como enviado</button>
                  </form>
                )}
                <form action={archiveInvitationAction}>
                  <input type="hidden" name="id" value={id} />
                  {inv.archivedAt ? (
                    <button className="a-btn a-btn--sm" name="restore" value="1">
                      Restaurar convite
                    </button>
                  ) : (
                    <ConfirmSubmit message="Arquivar este convite? O link deixa de funcionar, mas nada é apagado.">Arquivar</ConfirmSubmit>
                  )}
                </form>
              </div>
            ) : null}
          </section>

          <section className="a-card" id="historico">
            <h2 className="a-card__title">Histórico</h2>
            {events.length ? (
              <ol className="a-timeline">
                {events.map((e) => (
                  <li key={e.id}>
                    <time>{formatDateTimeCompact(e.createdAt)}</time>
                    {eventLabel(e.type, e.data)}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="a-muted">Sem eventos.</p>
            )}
          </section>

          <section className="a-card">
            <h2 className="a-card__title">Presentes</h2>
            {payments.length ? (
              <ul className="a-list-plain">
                {payments.map((p) => (
                  <li key={p.id}>
                    <strong>{p.giftName}</strong> · {formatBRL(p.amountCents)} <PaymentBadge status={p.status} />
                    <div className="a-muted">{formatDateTime(p.createdAt)} · {p.payerName}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="a-muted">Nenhum presente ainda.</p>
            )}
          </section>

          <section className="a-card">
            <h2 className="a-card__title">
              Mensagens <small>{photos.length ? `${photos.length} foto(s) no álbum` : ''}</small>
            </h2>
            {messages.length ? (
              <ul className="a-list-plain">
                {messages.map((m) => (
                  <li key={m.id}>
                    <div style={{ whiteSpace: 'pre-line' }}>“{m.content}”</div>
                    <div className="a-muted">{formatDateTime(m.createdAt)} · {m.source === 'rsvp' ? 'RSVP' : m.source === 'gift' ? 'Presente' : 'Livro de mensagens'}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="a-muted">Nenhuma mensagem.</p>
            )}
          </section>
        </div>
      </div>
    </WhatsAppProvider>
  )
}
