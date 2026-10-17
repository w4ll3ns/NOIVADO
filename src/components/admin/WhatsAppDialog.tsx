'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { renderTemplate, type TemplateValues } from '@/lib/templates'
import { defaultTemplateFor, whatsappUrl } from '@/lib/whatsapp'
import { formatPhone } from '@/lib/format'
import type { InvitationKind, WhatsappTemplateKind } from '@/lib/db/schema'
import { CopyButton } from './ClientBits'

export type WaTemplate = { id: string; name: string; kind: WhatsappTemplateKind; body: string; isDefault: boolean }
export type WaInvitation = {
  id: string
  label: string
  greeting: string
  phone: string | null
  /** Quem recebe: cada pessoa com telefone (numa família, todos com o mesmo link). */
  recipients: { name: string; phone: string }[]
  link: string
  kind: InvitationKind
  isCloseFamily: boolean
  whatsappTemplateId: string | null
  sent: boolean
}

type Ctx = {
  open: (invitation: WaInvitation, mode: 'invite' | 'reminder') => void
}

const WaContext = createContext<Ctx | null>(null)

type ProviderProps = {
  templates: WaTemplate[]
  eventValues: TemplateValues
  onOpened: (invitationId: string, mode: 'invite' | 'reminder', templateName: string) => Promise<void>
  onMarkSent: (invitationId: string) => Promise<void>
  children: React.ReactNode
}

/** Um único diálogo de WhatsApp para a página inteira (os modelos trafegam uma vez só). */
export function WhatsAppProvider({ templates, eventValues, onOpened, onMarkSent, children }: ProviderProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [current, setCurrent] = useState<{ invitation: WaInvitation; mode: 'invite' | 'reminder' } | null>(null)
  const [templateId, setTemplateId] = useState('')
  const [edited, setEdited] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const open = useCallback(
    (invitation: WaInvitation, mode: 'invite' | 'reminder') => {
      setCurrent({ invitation, mode })
      setTemplateId(defaultTemplateFor(templates, invitation, mode)?.id ?? templates[0]?.id ?? '')
      setEdited(null)
      setStatus(null)
      ref.current?.showModal()
    },
    [templates],
  )

  const invitation = current?.invitation
  const mode = current?.mode ?? 'invite'
  const defaultId = invitation ? defaultTemplateFor(templates, invitation, mode)?.id : undefined
  const template = templates.find((t) => t.id === templateId)
  const rendered = useMemo(
    () =>
      template && invitation
        ? renderTemplate(template.body, {
            ...eventValues,
            NOME_CONVIDADO: invitation.greeting,
            NOME_GRUPO: invitation.label,
            LINK_CONVITE: invitation.link,
          })
        : '',
    [template, eventValues, invitation],
  )
  const message = edited ?? rendered
  const recipients = invitation?.recipients ?? []
  const varios = recipients.length > 1
  const url = invitation ? whatsappUrl(recipients[0]?.phone ?? invitation.phone, message) : null
  const abrir = (target: string | null) => {
    if (!target || !invitation) return
    // Abre primeiro (dentro do gesto do usuário), registra depois.
    window.open(target, '_blank', 'noopener,noreferrer')
    void onOpened(invitation.id, mode, template?.name ?? '').then(() => setStatus('Aberto no WhatsApp e marcado como enviado.'))
  }

  return (
    <WaContext.Provider value={{ open }}>
      {children}
      <dialog ref={ref} className="a-dialog" aria-label="Enviar pelo WhatsApp" onClose={() => setCurrent(null)}>
        {invitation ? (
          <>
            <div className="a-dialog__head">
              <strong>{mode === 'reminder' ? 'Enviar lembrete' : 'Enviar convite'} pelo WhatsApp</strong>
              <button type="button" className="a-btn a-btn--sm a-btn--ghost" onClick={() => ref.current?.close()} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="a-dialog__body">
              <div className="a-form-grid">
                <div>
                  <div className="a-label">Para</div>
                  <div>{invitation.label}</div>
                </div>
                <div>
                  <div className="a-label">{varios ? 'Telefones' : 'Telefone'}</div>
                  {recipients.length ? (
                    recipients.map((r) => (
                      <div key={r.phone}>
                        {varios ? `${r.name} · ` : ''}
                        {formatPhone(r.phone)}
                      </div>
                    ))
                  ) : (
                    <span className="a-muted">Sem telefone cadastrado</span>
                  )}
                </div>
              </div>
              <label className="a-field">
                <span>Modelo</span>
                <select
                  className="a-select"
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value)
                    setEdited(null)
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.id === defaultId ? ' (padrão)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <div className="a-label" style={{ marginBottom: 4 }}>
                  Mensagem
                </div>
                <div className="a-wa-preview">{message}</div>
              </div>
              <details>
                <summary className="a-help" style={{ cursor: 'pointer' }}>
                  Ajustar o texto só para este envio
                </summary>
                <textarea className="a-textarea" rows={8} value={message} onChange={(e) => setEdited(e.target.value)} style={{ marginTop: 6 }} />
              </details>
              {varios ? (
                <div>
                  <div className="a-label" style={{ marginBottom: 4 }}>
                    Enviar para cada um (o mesmo link do convite)
                  </div>
                  <div className="a-actions">
                    {recipients.map((r) => (
                      <button key={r.phone} type="button" className="a-btn a-btn--wa" onClick={() => abrir(whatsappUrl(r.phone, message))}>
                        WhatsApp · {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {status ? <p className="a-alert a-alert--ok">{status}</p> : null}
            </div>
            <div className="a-dialog__foot">
              <CopyButton text={invitation.link} label="Copiar link" className="a-btn" />
              <CopyButton text={message} label="Copiar mensagem" className="a-btn" />
              {!invitation.sent ? (
                <button
                  type="button"
                  className="a-btn"
                  onClick={async () => {
                    await onMarkSent(invitation.id)
                    setStatus('Marcado como enviado.')
                  }}
                >
                  Marcar como enviado
                </button>
              ) : null}
              {!varios ? (
                <button type="button" className="a-btn a-btn--wa" disabled={!url} onClick={() => abrir(url)}>
                  Abrir no WhatsApp
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </dialog>
    </WaContext.Provider>
  )
}

export function WhatsAppTrigger({ invitation, mode, label, className }: { invitation: WaInvitation; mode: 'invite' | 'reminder'; label?: string; className?: string }) {
  const ctx = useContext(WaContext)
  return (
    <button type="button" className={className ?? 'a-btn a-btn--sm a-btn--wa'} onClick={() => ctx?.open(invitation, mode)}>
      {label ?? (mode === 'reminder' ? 'Lembrete' : 'WhatsApp')}
    </button>
  )
}
