import { describe, expect, it } from 'vitest'
import { daysUntil, endOfDayInTz, formatBRL, formatDateDots, formatDateLong, formatPhone, formatTime, joinNames, normalizePhone, parseBRLToCents, weekdayOf } from '@/lib/format'

describe('formatação', () => {
  it('formata datas do evento', () => {
    expect(formatDateLong('2026-10-31')).toBe('31 de outubro de 2026')
    expect(formatDateDots('2026-10-31')).toBe('31 . 10 . 2026')
    expect(weekdayOf('2026-10-31')).toBe('sábado')
  })

  it('formata horários no estilo brasileiro', () => {
    expect(formatTime('19:30')).toBe('19h30')
    expect(formatTime('20:00')).toBe('20h')
  })

  it('conta dias no fuso de São Luís', () => {
    // 23/09/2026 23:30 em Fortaleza = 24/09 02:30 UTC — ainda é dia 23 lá.
    expect(daysUntil('2026-10-31', new Date('2026-09-24T02:30:00Z'))).toBe(38)
    expect(daysUntil('2026-10-31', new Date('2026-10-31T12:00:00Z'))).toBe(0)
    expect(daysUntil('2026-10-31', new Date('2026-11-01T12:00:00Z'))).toBe(-1)
  })

  it('prazo termina no fim do dia (UTC-3)', () => {
    expect(endOfDayInTz('2026-10-15')!.toISOString()).toBe('2026-10-16T02:59:59.000Z')
  })

  it('valores em reais', () => {
    expect(formatBRL(35000)).toBe('R$ 350,00')
    expect(parseBRLToCents('350')).toBe(35000)
    expect(parseBRLToCents('350,50')).toBe(35050)
    expect(parseBRLToCents('R$ 1.234,56')).toBe(123456)
    expect(parseBRLToCents('1.000')).toBe(100000)
    expect(parseBRLToCents('12.5')).toBe(1250)
    expect(parseBRLToCents('abc')).toBeNull()
  })

  it('telefones brasileiros', () => {
    expect(normalizePhone('(98) 99999-0001')).toBe('5598999990001')
    expect(normalizePhone('+55 98 99999-0001')).toBe('5598999990001')
    expect(normalizePhone('123')).toBeNull()
    expect(formatPhone('5598999990001')).toBe('+55 98 99999-0001')
  })

  it('junta nomes', () => {
    expect(joinNames(['João'])).toBe('João')
    expect(joinNames(['João', 'Maria'])).toBe('João e Maria')
    expect(joinNames(['João', 'Maria', 'Pedro'])).toBe('João, Maria e Pedro')
  })
})
