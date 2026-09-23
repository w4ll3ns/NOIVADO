export const EVENT_TZ = 'America/Fortaleza'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlShort = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** R$ 350,00 */
export function formatBRL(cents: number | null | undefined): string {
  return brl.format((cents ?? 0) / 100).replace(/ /g, ' ')
}

/** R$ 350 (sem centavos quando o valor é inteiro) */
export function formatBRLShort(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100
  const s = Number.isInteger(value) ? brlShort.format(value) : brl.format(value)
  return s.replace(/ /g, ' ')
}

/** Converte "350", "350,50", "1.234,56" ou "R$ 1.234,56" em centavos. */
export function parseBRLToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null
  let s = input.replace(/[^\d,.-]/g, '').trim()
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if ((s.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

/** "31 de outubro de 2026" */
export function formatDateLong(iso: string): string {
  const p = parseIsoDate(iso)
  if (!p) return iso
  return `${p.d} de ${MONTHS[p.m - 1]} de ${p.y}`
}

/** "31 . 10 . 2026" */
export function formatDateDots(iso: string): string {
  const p = parseIsoDate(iso)
  if (!p) return iso
  return `${String(p.d).padStart(2, '0')} . ${String(p.m).padStart(2, '0')} . ${p.y}`
}

/** "31/10/2026" */
export function formatDateShort(iso: string): string {
  const p = parseIsoDate(iso)
  if (!p) return iso
  return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`
}

/** "19:30" → "19h30", "20:00" → "20h" */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return ''
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return hhmm
  return m[2] === '00' ? `${Number(m[1])}h` : `${Number(m[1])}h${m[2]}`
}

/** Data (YYYY-MM-DD) de um instante no fuso do evento. */
export function isoDateInTz(date: Date, timeZone = EVENT_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return parts
}

/** Dias de calendário entre hoje (no fuso do evento) e a data do evento. */
export function daysUntil(eventIsoDate: string, now = new Date()): number {
  const today = parseIsoDate(isoDateInTz(now))!
  const target = parseIsoDate(eventIsoDate)
  if (!target) return 0
  const a = Date.UTC(today.y, today.m - 1, today.d)
  const b = Date.UTC(target.y, target.m - 1, target.d)
  return Math.round((b - a) / 86_400_000)
}

/** Fim do dia (23:59:59) no fuso do evento — usado para prazos como o do RSVP. */
export function endOfDayInTz(iso: string): Date | null {
  const p = parseIsoDate(iso)
  if (!p) return null
  // America/Fortaleza é UTC-3 fixo (sem horário de verão).
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 23 + 3, 59, 59))
}

const dtFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: EVENT_TZ,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const dtFullFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: EVENT_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const dFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: EVENT_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** "18/10 10:15" */
export function formatDateTimeCompact(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return dtFmt.format(new Date(date)).replace(',', '')
}

/** "18/10/2026 10:15" */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return dtFullFmt.format(new Date(date)).replace(',', '')
}

/** "20/10/2026" */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return dFmt.format(new Date(date))
}

/* Telefones ----------------------------------------------------------- */

/** Normaliza para dígitos com DDI (padrão Brasil). Retorna null se inválido. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  let digits = input.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits.replace(/^0/, '')
  else if (digits.length === 12 && digits.startsWith('0')) digits = '55' + digits.slice(1)
  if (digits.length < 10 || digits.length > 15) return null
  return digits
}

/** "+55 98 99999-9999" */
export function formatPhone(input: string | null | undefined): string {
  const d = normalizePhone(input)
  if (!d) return input ?? ''
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4)
    const rest = d.slice(4)
    const split = rest.length === 9 ? 5 : 4
    return `+55 ${ddd} ${rest.slice(0, split)}-${rest.slice(split)}`
  }
  return `+${d}`
}

/* Nomes ------------------------------------------------------------- */

/** ["João", "Maria", "Pedro"] → "João, Maria e Pedro" */
export function joinNames(names: string[]): string {
  const list = names.map((n) => n.trim()).filter(Boolean)
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`
}

export function fullName(first: string, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim()
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

/** "sábado" */
export function weekdayOf(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return WEEKDAYS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]
}
