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

describe('Range da música de fundo', () => {
  it('interpreta os formatos de trecho', async () => {
    const { parseRange } = await import('@/lib/http-range')
    expect(parseRange(null, 1000)).toBeNull()
    expect(parseRange('bytes=0-1', 1000)).toEqual({ start: 0, end: 1 })
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 })
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=1000-', 1000)).toBe('invalid')
    expect(parseRange('bytes=0-1,5-9', 1000)).toBeNull()
  })
})

describe('pedido com vários presentes no Mercado Pago', () => {
  it('um item por presente, com a referência do pedido', async () => {
    const { buildPreferenceBody } = await import('@/lib/payments/mercadopago')
    const body = buildPreferenceBody({
      externalReference: 'pedido-1',
      items: [
        { id: 'a', title: 'Presente: Jantar', amountCents: 35000 },
        { id: 'b', title: 'Presente: Café', description: 'Para a casa', amountCents: 18050 },
      ],
      payer: { name: 'Ana Maria Souza', email: 'ana@example.com' },
      appUrl: 'https://maby-chris.example',
      maxInstallments: 12,
      expiresAt: new Date('2026-10-01T00:00:00Z'),
    })
    expect(body.items.map((i) => [i.id, i.unit_price, i.quantity])).toEqual([
      ['a', 350, 1],
      ['b', 180.5, 1],
    ])
    expect(body.items[1].description).toBe('Para a casa')
    expect(body.external_reference).toBe('pedido-1')
    expect(body.back_urls.success).toBe('https://maby-chris.example/presentes/retorno?ref=pedido-1')
    expect(body.payer).toMatchObject({ name: 'Ana', surname: 'Maria Souza' })
  })
})

describe('checkout só com Pix e cartão de crédito', () => {
  it('tira do checkout só os tipos que existem na conta (e nunca Pix, crédito ou saldo)', async () => {
    const { typesToExclude, SAFE_EXCLUDED_TYPES } = await import('@/lib/payments/mercadopago')
    const m = (id: string, type: string, status = 'active') => ({ id, payment_type_id: type, status })
    expect(
      typesToExclude([
        m('pix', 'bank_transfer'),
        m('visa', 'credit_card'),
        m('bolbradesco', 'ticket'),
        m('debelo', 'debit_card'),
        m('account_money', 'account_money'),
        m('consumer_credits', 'digital_currency'),
        m('velho', 'prepaid_card', 'inactive'),
      ]),
    ).toEqual(['ticket', 'debit_card', 'digital_currency'])
    expect(typesToExclude([])).toEqual(SAFE_EXCLUDED_TYPES)
  })

  it('datas no fuso de Brasília e Pix vencendo junto com a reserva', async () => {
    const { buildPreferenceBody, mpDate } = await import('@/lib/payments/mercadopago')
    expect(mpDate(new Date('2026-10-08T20:30:00.000Z'))).toBe('2026-10-08T17:30:00.000-03:00')
    const body = buildPreferenceBody({
      externalReference: 'p',
      items: [{ id: 'a', title: 'x', amountCents: 100 }],
      payer: { name: 'Ana', email: 'a@b.c' },
      appUrl: 'https://x.example',
      maxInstallments: 6,
      expiresAt: new Date('2026-10-09T03:00:00.000Z'),
      excludedPaymentTypes: ['ticket', 'debit_card'],
    })
    expect(body.payment_methods).toEqual({ installments: 6, excluded_payment_types: [{ id: 'ticket' }, { id: 'debit_card' }] })
    expect(body.date_of_expiration).toBe('2026-10-09T00:00:00.000-03:00')
    expect(body.expiration_date_to).toBe(body.date_of_expiration)
  })
})

describe('pagamento no próprio site', () => {
  it('valida e formata CPF', async () => {
    const { isCpf, formatCpf } = await import('@/lib/cpf')
    expect(isCpf('529.982.247-25')).toBe(true)
    expect(isCpf('123.456.789-00')).toBe(false)
    expect(isCpf('111.111.111-11')).toBe(false)
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
  })

  it('Pix sai com o valor do pedido, a referência e os dados certos; motivos de recusa do cartão', async () => {
    const { buildPixPaymentBody, cardRejectionMessage, rejectionReason } = await import('@/lib/payments/mercadopago')
    const base = {
      orderId: 'pedido-9',
      amountCents: 53000,
      description: 'Presentes para Maby & Chris',
      appUrl: 'https://maby-chris.example',
      items: [{ id: 'l1', title: 'Kit de vinhos', amountCents: 35000 }],
      payerName: 'Ana Maria Souza',
    }
    const pix = buildPixPaymentBody({ ...base, payerEmail: 'ana@example.com', cpf: '52998224725', expiresAt: new Date('2026-10-08T21:00:00Z') })
    expect(pix).toMatchObject({
      transaction_amount: 530,
      payment_method_id: 'pix',
      external_reference: 'pedido-9',
      date_of_expiration: '2026-10-08T18:00:00.000-03:00',
      notification_url: 'https://maby-chris.example/api/webhooks/mercadopago?source_news=webhooks',
      payer: { email: 'ana@example.com', first_name: 'Ana', last_name: 'Maria Souza', identification: { type: 'CPF', number: '52998224725' } },
    })
    // Dados para o antifraude: categoria dos itens e telefone do comprador
    expect(pix.additional_info.items[0]).toMatchObject({ category_id: 'others', quantity: 1, unit_price: 350 })
    expect(pix.additional_info.payer).not.toHaveProperty('phone')
    const comFone = buildPixPaymentBody({ ...base, payerPhone: '5598999998888', payerEmail: 'a@b.co', cpf: '52998224725', expiresAt: new Date() })
    expect(comFone.additional_info.payer).toMatchObject({ first_name: 'Ana', phone: { area_code: '98', number: '999998888' } })
    expect(cardRejectionMessage('cc_rejected_insufficient_amount')).toMatch(/limite/)
    expect(cardRejectionMessage('cc_rejected_high_risk')).toMatch(/por segurança/)
    expect(cardRejectionMessage('qualquer')).toMatch(/não foi aprovado/)
    expect(rejectionReason('cc_rejected_high_risk')).toBe('antifraude do Mercado Pago (alto risco) (cc_rejected_high_risk)')
    expect(rejectionReason('novo_codigo')).toBe('novo_codigo')
  })
})
