'use client'

import { useMemo, useState } from 'react'
import { renderTemplate, type TemplateValues } from '@/lib/templates'
import { defaultTemplateFor, whatsappUrl } from '@/lib/whatsapp'
import { formatPhone } from '@/lib/format'
import type { WaInvitation, WaTemplate } from '@/components/admin/WhatsAppDialog'
import { CopyButton } from '@/components/admin/ClientBits'

type Props = {
  items: WaInvitation[]
  templates: WaTemplate[]
  eventValues: TemplateValues
  mode: 'invite' | 'reminder'
  onOpened: (invitationId: string, mode: 'invite' | 'reminder', templateName: string) => Promise<void>
}

/** Envio em sequência: um convite por vez — abrir no WhatsApp, voltar, próximo. */
export function SendQueue({ items, templates, eventValues, mode, onOpened }: Props) {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState<Set<string>>(new Set())
  const current = items[index]
  const template = current ? defaultTemplateFor(templates, current, mode) : undefined
  const message = useMemo(
    () =>
      current && template
        ? renderTemplate(template.body, { ...eventValues, NOME_CONVIDADO: current.greeting, NOME_GRUPO: current.label, LINK_CONVITE: current.link })
        : '',
    [current, template, eventValues],
  )
  if (!items.length) return <p className="a-muted">Nada na fila. 🎉</p>
  if (!current) return <p className="a-alert a-alert--ok">Fila concluída: {done.size} aberto(s) no WhatsApp.</p>
  const url = whatsappUrl(current.phone, message)

  return (
    <div className="a-card" style={{ background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong>
          {index + 1} de {items.length} · {current.label}
        </strong>
        <span className="a-muted">
          {current.phone ? formatPhone(current.phone) : 'Sem telefone'} · modelo: {template?.name ?? '—'}
        </span>
      </div>
      <div className="a-wa-preview">{message}</div>
      <div className="a-actions" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="a-btn a-btn--wa"
          disabled={!url}
          onClick={() => {
            if (!url) return
            window.open(url, '_blank', 'noopener,noreferrer')
            setDone((s) => new Set(s).add(current.id))
            void onOpened(current.id, mode, template?.name ?? '')
          }}
        >
          {done.has(current.id) ? 'Abrir de novo' : 'Abrir no WhatsApp'}
        </button>
        <CopyButton text={message} label="Copiar mensagem" className="a-btn" />
        <button type="button" className="a-btn" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          ‹ Anterior
        </button>
        <button type="button" className="a-btn a-btn--primary" onClick={() => setIndex((i) => i + 1)}>
          {done.has(current.id) ? 'Próximo ›' : 'Pular ›'}
        </button>
      </div>
    </div>
  )
}
