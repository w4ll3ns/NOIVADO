import { describe, expect, it } from 'vitest'
import { renderTemplate, unknownVariables } from '@/lib/templates'
import { defaultTemplateFor, whatsappUrl } from '@/lib/whatsapp'
import { availabilityOf, resolveGiftAmount } from '@/lib/gifts'
import { buildImport } from '@/lib/admin/import'
import { parseCsv, toCsv } from '@/lib/spreadsheet'
import { albumUploadState } from '@/lib/album-state'
import { coupleParts, monogramFor } from '@/lib/event'
import { parseSetting } from '@/lib/settings-schema'

describe('mensagens de WhatsApp', () => {
  it('substitui variáveis e preserva as desconhecidas', () => {
    const out = renderTemplate('Olá, {{NOME_CONVIDADO}}! {{LINK_CONVITE}} {{OUTRA}}', { NOME_CONVIDADO: 'João e Maria', LINK_CONVITE: 'https://x/i/abc' })
    expect(out).toBe('Olá, João e Maria! https://x/i/abc {{OUTRA}}')
    expect(unknownVariables('{{NOME_CASAL}} {{NOME_ERRADO}}')).toEqual(['NOME_ERRADO'])
  })

  it('monta o link com a mensagem codificada', () => {
    expect(whatsappUrl('(98) 99999-0001', 'Olá ❤️')).toBe('https://api.whatsapp.com/send?phone=5598999990001&text=Ol%C3%A1%20%E2%9D%A4%EF%B8%8F')
    expect(whatsappUrl(null, 'x')).toBeNull()
  })

  it('escolhe o modelo padrão pelo tipo do convite', () => {
    const t = [
      { id: '1', kind: 'invite_individual' as const, isDefault: true, name: 'Individual' },
      { id: '2', kind: 'invite_family' as const, isDefault: true, name: 'Família' },
      { id: '3', kind: 'rsvp_reminder' as const, isDefault: true, name: 'Lembrete' },
      { id: '4', kind: 'invite_close_family' as const, isDefault: true, name: 'Próximos' },
    ]
    expect(defaultTemplateFor(t, { whatsappTemplateId: null, kind: 'family', isCloseFamily: false }, 'invite')?.id).toBe('2')
    expect(defaultTemplateFor(t, { whatsappTemplateId: null, kind: 'family', isCloseFamily: true }, 'invite')?.id).toBe('4')
    expect(defaultTemplateFor(t, { whatsappTemplateId: '1', kind: 'family', isCloseFamily: false }, 'invite')?.id).toBe('1')
    expect(defaultTemplateFor(t, { whatsappTemplateId: null, kind: 'couple', isCloseFamily: false }, 'reminder')?.id).toBe('3')
  })
})

describe('presentes', () => {
  it('disponibilidade considera aprovados e reservas', () => {
    expect(availabilityOf({ availability: 'unique', quantity: 1 }, { approved: 0, reserved: 0 }).available).toBe(true)
    expect(availabilityOf({ availability: 'unique', quantity: 1 }, { approved: 1, reserved: 0 }).available).toBe(false)
    expect(availabilityOf({ availability: 'unique', quantity: 1 }, { approved: 0, reserved: 1 }).available).toBe(false)
    expect(availabilityOf({ availability: 'limited', quantity: 3 }, { approved: 1, reserved: 1 }).remaining).toBe(1)
    expect(availabilityOf({ availability: 'unlimited', quantity: null }, { approved: 99, reserved: 5 }).available).toBe(true)
  })

  it('valor fixo não pode ser alterado; personalizado respeita mínimo e máximo', () => {
    expect(resolveGiftAmount({ priceType: 'fixed', amountCents: 35000, minCents: null, maxCents: null }, 1)).toEqual({ cents: 35000, error: null })
    const custom = { priceType: 'custom' as const, amountCents: null, minCents: 5000, maxCents: 100000 }
    expect(resolveGiftAmount(custom, 20000).cents).toBe(20000)
    expect(resolveGiftAmount(custom, 1000).error).toMatch(/mínimo/)
    expect(resolveGiftAmount(custom, 200000).error).toMatch(/máximo/)
    expect(resolveGiftAmount(custom, null).error).not.toBeNull()
  })
})

describe('importação de convidados', () => {
  it('agrupa pessoas pelo convite e infere o tipo', () => {
    const csv = 'Convite;Nome;Sobrenome;Telefone;Acompanhante\nFamília Silva;João;Silva;(98) 99999-0001;\nFamília Silva;Maria;Silva;;\n;Beatriz;Almeida;98999990003;sim\n'
    const { invitations, errors } = buildImport(parseCsv(csv))
    expect(errors).toEqual([])
    expect(invitations).toHaveLength(2)
    expect(invitations[0]).toMatchObject({ label: 'Família Silva', kind: 'couple', phone: '5598999990001' })
    expect(invitations[0].guests.map((g) => g.firstName)).toEqual(['João', 'Maria'])
    expect(invitations[1]).toMatchObject({ label: 'Beatriz Almeida', kind: 'individual', allowCompanions: true, maxCompanions: 1 })
  })

  it('CSV lida com aspas, vírgulas e neutraliza fórmulas', () => {
    expect(parseCsv('a,b\n"x, y","z ""q"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'z "q"'],
    ])
    expect(toCsv({ headers: ['n'], rows: [['=HYPERLINK("x")']] })).toContain(`"'=HYPERLINK(""x"")"`)
  })
})

describe('álbum', () => {
  const base = { status: 'open' as const, uploadsEnabled: true, startsAt: null, endsAt: null }
  it('estado de envio', () => {
    expect(albumUploadState(base)).toBe('open')
    expect(albumUploadState({ ...base, uploadsEnabled: false })).toBe('closed')
    expect(albumUploadState({ ...base, endsAt: new Date('2020-01-01') })).toBe('closed')
    expect(albumUploadState({ ...base, startsAt: new Date('2999-01-01') })).toBe('not_started')
    expect(albumUploadState({ ...base, status: 'draft' })).toBe('draft')
  })
})

describe('configurações', () => {
  it('valores padrão refletem o Save the Date', () => {
    const e = parseSetting('event', {})
    expect(e.coupleNames).toBe('Maby & Chris')
    expect(e.date).toBe('2026-10-31')
    expect(e.venueName).toBe('Casa de Zaquia')
  })

  it('valor salvo inválido não derruba o site', () => {
    const e = parseSetting('event', { date: 'ontem', venueName: 'Outro local' })
    expect(e.date).toBe('2026-10-31')
    expect(e.venueName).toBe('Outro local')
  })

  it('monograma do casal', () => {
    expect(coupleParts('Maby & Chris')).toEqual({ a: 'Maby', joiner: '&', b: 'Chris' })
    expect(monogramFor('Maby & Chris')).toBe('M&C')
  })
})
