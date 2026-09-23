import type { Settings } from '@/lib/settings-schema'
import { formatDateLong, formatTime } from '@/lib/format'

export const TEMPLATE_VARS = [
  'NOME_CONVIDADO',
  'NOME_GRUPO',
  'LINK_CONVITE',
  'NOME_CASAL',
  'DATA_EVENTO',
  'HORARIO_EVENTO',
  'LOCAL_EVENTO',
  'ENDERECO_EVENTO',
  'PRAZO_RSVP',
] as const
export type TemplateVar = (typeof TEMPLATE_VARS)[number]
export type TemplateValues = Partial<Record<TemplateVar, string>>

/** Substitui {{VARIAVEL}}; variáveis desconhecidas ficam como estão (para o admin perceber). */
export function renderTemplate(body: string, values: TemplateValues): string {
  return body.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (match, key: string) => {
    const v = values[key as TemplateVar]
    return v === undefined ? match : v
  })
}

export function unknownVariables(body: string): string[] {
  const found = new Set<string>()
  for (const m of body.matchAll(/\{\{\s*([A-Z_]+)\s*\}\}/g)) {
    if (!(TEMPLATE_VARS as readonly string[]).includes(m[1])) found.add(m[1])
  }
  return [...found]
}

export function eventTemplateValues(settings: Pick<Settings, 'event' | 'rsvp'>): TemplateValues {
  const e = settings.event
  return {
    NOME_CASAL: e.coupleNames,
    DATA_EVENTO: formatDateLong(e.date),
    HORARIO_EVENTO: formatTime(e.receptionTime || e.mainTime),
    LOCAL_EVENTO: e.venueName,
    ENDERECO_EVENTO: e.address,
    PRAZO_RSVP: settings.rsvp.deadline ? formatDateLong(settings.rsvp.deadline) : 'a data combinada',
  }
}
