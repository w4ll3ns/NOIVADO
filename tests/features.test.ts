import { describe, expect, it } from 'vitest'
import { renderTemplate, unknownVariables } from '@/lib/templates'
import { defaultTemplateFor, whatsappUrl } from '@/lib/whatsapp'
import { availabilityOf, resolveGiftAmount } from '@/lib/gifts'
import { strToU8, zipSync } from 'fflate'
import { buildImport, importSignature } from '@/lib/admin/import'
import { parseCsv, parseXlsx, toCsv } from '@/lib/spreadsheet'
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

  it('“Família N” só junta as pessoas: o convite leva os nomes; homônimos individuais não se misturam', () => {
    const csv = [
      'Convite;Tipo;Grupo;Nome;Telefone',
      'Família 1;Família;Família 1;Ana;+55 98 8000-0001',
      'Família 1;Família;Família 1;Bento;+55 98 8000-0002',
      'Manu;Individual;;Manu;',
      'Família 18;Família;Família 18;Caio;',
      'Família 18;Família;Família 18;Duda;',
      'Família 18;Família;Família 18;Elis;+55 98 8000-0003',
      'Manu;Individual;;Manu;+55 86 9000-0004',
      'Família Souza;;;Fábio;',
    ].join('\n')
    const { invitations, errors } = buildImport(parseCsv(csv))
    expect(invitations.map((i) => i.label)).toEqual(['Ana e Bento', 'Manu', 'Caio, Duda e Elis', 'Manu', 'Família Souza'])
    expect(invitations.every((i) => i.groupName === null)).toBe(true)
    expect(JSON.stringify(invitations)).not.toMatch(/Família \d/)
    // um convite (um link) por família, cada pessoa com o seu telefone
    expect(invitations[0].guests.map((g) => g.phone)).toEqual(['559880000001', '559880000002'])
    expect(invitations[0]).toMatchObject({ kind: 'family', phone: '559880000001' })
    expect(invitations[2]).toMatchObject({ kind: 'family', phone: '559880000003' })
    // as duas "Manu" são pessoas diferentes
    expect(invitations[1].guests).toHaveLength(1)
    expect(invitations[3].guests[0].phone).toBe('558690000004')
    expect(importSignature(invitations[1])).not.toBe(importSignature(invitations[3]))
    expect(errors.join(' ')).toMatch(/“Manu” aparece em 2 convites/)
  })

  it('lê .xlsx gerado por outros programas (caminhos absolutos e prefixo x:)', async () => {
    const ns = 'http://schemas.openxmlformats.org/'
    const rel = (id: string, type: string, target: string) => `<Relationship Type="${ns}officeDocument/2006/relationships/${type}" Target="${target}" Id="${id}" />`
    const files = {
      '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types/>'),
      '_rels/.rels': strToU8(`<Relationships>${rel('R1', 'officeDocument', '/xl/workbook.xml')}</Relationships>`),
      'xl/_rels/workbook.xml.rels': strToU8(`<Relationships>${rel('R2', 'sharedStrings', '/xl/sharedStrings.xml')}${rel('R3', 'worksheet', '/xl/worksheets/sheet1.xml')}</Relationships>`),
      'xl/workbook.xml': strToU8(`<x:workbook xmlns:x="${ns}spreadsheetml/2006/main"><x:sheets><x:sheet name="Convidados" sheetId="1" r:id="R3" xmlns:r="r" /></x:sheets></x:workbook>`),
      'xl/sharedStrings.xml': strToU8('<x:sst><x:si><x:t>Convite</x:t></x:si><x:si><x:t>Nome</x:t></x:si><x:si><x:r><x:t>Fam</x:t></x:r><x:r><x:t>ília 1</x:t></x:r></x:si><x:si><x:t>João &amp; Cia</x:t></x:si></x:sst>'),
      'xl/worksheets/sheet1.xml': strToU8(
        '<x:worksheet><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c><x:c r="C1" t="inlineStr"><x:is><x:t>Telefone</x:t></x:is></x:c></x:row>' +
          '<x:row r="2"><x:c r="A2" t="s"><x:v>2</x:v></x:c><x:c r="B2" t="s"><x:v>3</x:v></x:c><x:c r="C2"><x:v>98980000001</x:v></x:c></x:row>' +
          '<x:row r="3"><x:c r="B3" t="inlineStr"><x:is><x:t>Bia</x:t></x:is></x:c></x:row></x:sheetData></x:worksheet>',
      ),
    }
    const rows = await parseXlsx(Buffer.from(zipSync(files)))
    expect(rows).toEqual([
      ['Convite', 'Nome', 'Telefone'],
      ['Família 1', 'João & Cia', '98980000001'],
      ['', 'Bia'],
    ])
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

describe('agenda do celular (.vcf)', () => {
  it('lê iPhone (item1.TEL, dobras) e Android antigo (quoted-printable), ignora quem não tem telefone', async () => {
    const { lerVcard } = await import('@/lib/vcard')
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Souza;Jordania;;;',
      'FN:Jordania Souza',
      'item1.TEL;type=CELL;type=pref:+55 (98) 98539-1797',
      'item1.X-ABLabel:celular',
      'TEL;type=HOME:(98) 3222-0000',
      'PHOTO;ENCODING=b;TYPE=JPEG:AAAA',
      ' BBBB',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:;F=C3=A1bio;;;',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:F=C3=A1bio Ara=C3=BAjo d=',
      'a Silva',
      'TEL;CELL:98 8125-9495',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Sem Telefone',
      'EMAIL:x@y.z',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:4.0',
      'N:Lima\\; Neto;Gleiber;;;',
      'TEL;VALUE=uri;TYPE=cell:tel:+55-98-99999-0001',
      'END:VCARD',
    ].join('\r\n')
    expect(lerVcard(vcf)).toEqual([
      { nome: 'Jordania Souza', telefones: ['5598985391797', '559832220000'] },
      { nome: 'Fábio Araújo da Silva', telefones: ['559881259495'] },
      { nome: 'Gleiber Lima; Neto', telefones: ['5598999990001'] },
    ])
  })

  it('sugere contatos pelo nome (primeiro nome, depois sobrenome)', async () => {
    const { sugerirContatos } = await import('@/lib/vcard')
    const agenda = [
      { nome: 'João Pedro', telefones: ['1'] },
      { nome: 'Tia Rosina', telefones: ['2'] },
      { nome: 'Joao Silva', telefones: ['3'] },
      { nome: 'Maria', telefones: ['4'] },
      { nome: 'Joãozinho', telefones: ['5'] },
    ]
    // nome completo bate: só ele
    expect(sugerirContatos({ firstName: 'João', lastName: 'Silva' }, agenda).map((c) => c.nome)).toEqual(['Joao Silva'])
    // só o primeiro nome: todos os João (sem "Joãozinho")
    expect(sugerirContatos({ firstName: 'João' }, agenda).map((c) => c.nome)).toEqual(['João Pedro', 'Joao Silva'])
    expect(sugerirContatos({ firstName: 'Rosina' }, agenda).map((c) => c.nome)).toEqual(['Tia Rosina'])
    expect(sugerirContatos({ firstName: 'Ester' }, agenda)).toEqual([])
    // nome com duas palavras no mesmo campo ("Maria José"), e sobrenome sozinho não puxa ninguém
    const outra = [{ nome: 'Maria José Lima', telefones: ['6'] }, { nome: 'Maria Clara', telefones: ['7'] }, { nome: 'Pedro Silva', telefones: ['8'] }]
    expect(sugerirContatos({ firstName: 'Maria José' }, outra).map((c) => c.nome)).toEqual(['Maria José Lima'])
    expect(sugerirContatos({ firstName: 'Ana', lastName: 'Silva' }, outra)).toEqual([])
  })
})
