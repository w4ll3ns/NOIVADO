import type { EventSettings } from '@/lib/settings-schema'
import { formatDateDots, formatDateLong, formatTime } from '@/lib/format'

export function eventPlaceQuery(event: EventSettings) {
  return [event.venueName, event.address].filter(Boolean).join(', ')
}

export function googleMapsUrl(event: EventSettings) {
  return (
    event.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventPlaceQuery(event))}`
  )
}

export function wazeUrl(event: EventSettings) {
  return event.wazeUrl || `https://waze.com/ul?q=${encodeURIComponent(eventPlaceQuery(event))}&navigate=yes`
}

export function eventLabels(event: EventSettings) {
  return {
    dateLong: formatDateLong(event.date),
    dateDots: formatDateDots(event.date),
    reception: formatTime(event.receptionTime),
    main: formatTime(event.mainTime),
    /** Horário exibido como "o horário do evento" (recepção, se houver). */
    time: formatTime(event.receptionTime || event.mainTime),
  }
}

export type Moment = { timeLabel: string; title: string }

/**
 * O horário do evento: o do primeiro momento da programação; sem programação, o horário de
 * recepção (ou o principal) de Configurações → Evento.
 */
export function eventTime(event: EventSettings, first?: Moment | null) {
  if (first?.timeLabel) return { time: first.timeLabel, label: first.title }
  return {
    time: formatTime(event.receptionTime || event.mainTime),
    label: event.receptionTime ? 'Recepção dos convidados' : 'Início da celebração',
  }
}

/** Separa "Maby & Chris" em partes para a caligrafia ("Maby", "&", "Chris"). */
export function coupleParts(names: string): { a: string; joiner: string; b: string } | null {
  const m = /^(.+?)\s+(&|e|and)\s+(.+)$/i.exec(names.trim())
  if (!m) return null
  return { a: m[1], joiner: m[2], b: m[3] }
}

/** "Maby & Chris" → "M&C" */
export function monogramFor(names: string): string {
  const parts = coupleParts(names)
  if (!parts) return names.slice(0, 3)
  return `${parts.a.trim()[0] ?? ''}&${parts.b.trim()[0] ?? ''}`
}
