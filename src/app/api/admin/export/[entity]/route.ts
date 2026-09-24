import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { getAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { toCsv, toXlsx, type Table } from '@/lib/spreadsheet'
import { loadInvitationRows } from '@/lib/admin/invitations'
import { listPayments } from '@/lib/admin/payments'
import { KIND_LABEL, PAYMENT_LABEL, RSVP_LABEL, paymentMethodLabel } from '@/lib/admin/labels'
import { availabilityOf, giftCounts } from '@/lib/gifts'
import { formatDateTime, formatPhone, fullName } from '@/lib/format'

const money = (c: number | null | undefined) => (c == null ? null : c / 100)
// Sem "+" inicial (evita o escape anti-fórmula no CSV) e sem "—" em datas vazias.
const phone = (p: string | null | undefined) => (p ? formatPhone(p).replace(/^\+/, '') : '')
const when = (d: Date | null | undefined) => (d ? formatDateTime(d) : '')

async function build(entity: string, sp: URLSearchParams): Promise<{ name: string; table: Table } | null> {
  switch (entity) {
    case 'convites': {
      const rows = await loadInvitationRows({})
      return {
        name: 'Convites',
        table: {
          headers: ['Convite', 'Tipo', 'Grupo', 'Pessoas', 'Telefone', 'E-mail', 'Link', 'Enviado em', 'Primeiro acesso', 'Último acesso', 'Acessos', 'RSVP', 'Confirmados', 'Presentes (R$)', 'Observações'],
          rows: rows.map((r) => [
            r.inv.label,
            KIND_LABEL[r.inv.kind],
            r.groupName,
            r.guests.map((g) => fullName(g.firstName, g.lastName)).join(', '),
            phone(r.inv.phone),
            r.inv.email,
            r.link,
            when(r.inv.sentAt),
            when(r.inv.firstAccessedAt),
            when(r.inv.lastAccessedAt),
            r.inv.accessCount,
            RSVP_LABEL[r.inv.rsvpStatus],
            r.confirmed,
            money(r.gifts.reduce((s, g) => s + g.amountCents, 0)),
            r.inv.notes,
          ]),
        },
      }
    }
    case 'convidados': {
      const rows = await db
        .select({ g: schema.guests, label: schema.invitations.label, invId: schema.invitations.id })
        .from(schema.guests)
        .innerJoin(schema.invitations, eq(schema.invitations.id, schema.guests.invitationId))
        .where(and(isNull(schema.guests.removedAt), isNull(schema.invitations.archivedAt)))
        .orderBy(asc(schema.invitations.label), asc(schema.guests.sortOrder))
      const latest = await db.select().from(schema.rsvps).orderBy(desc(schema.rsvps.createdAt))
      const byInv = new Map<string, (typeof latest)[number]>()
      for (const r of latest) if (!byInv.has(r.invitationId)) byInv.set(r.invitationId, r)
      const att = { yes: 'Confirmado', no: 'Não comparecerá', pending: 'Aguardando' } as const
      return {
        name: 'Convidados',
        table: {
          headers: ['Nome', 'Sobrenome', 'Convite', 'Acompanhante', 'Criança', 'Presença', 'Telefone', 'E-mail', 'Restrição alimentar', 'Necessidade especial'],
          rows: rows.map(({ g, label, invId }) => [
            g.firstName,
            g.lastName,
            label,
            g.isCompanion,
            g.isChild,
            att[g.attendance],
            phone(g.phone),
            g.email,
            byInv.get(invId)?.dietaryRestrictions,
            byInv.get(invId)?.specialNeeds,
          ]),
        },
      }
    }
    case 'rsvp': {
      const rows = await db
        .select({ r: schema.rsvps, label: schema.invitations.label })
        .from(schema.rsvps)
        .innerJoin(schema.invitations, eq(schema.invitations.id, schema.rsvps.invitationId))
        .orderBy(desc(schema.rsvps.createdAt))
      return {
        name: 'RSVP',
        table: {
          headers: ['Data', 'Convite', 'Resposta', 'Confirmados', 'Recusados', 'Alteração', 'Restrição alimentar', 'Necessidade especial', 'Música', 'Observações', 'Mensagem'],
          rows: rows.map(({ r, label }) => [formatDateTime(r.createdAt), label, RSVP_LABEL[r.status], r.attendingCount, r.declinedCount, r.isChange, r.dietaryRestrictions, r.specialNeeds, r.songRequest, r.notes, r.messageToCouple]),
        },
      }
    }
    case 'presentes': {
      const [gifts, cats] = await Promise.all([db.select().from(schema.gifts).orderBy(asc(schema.gifts.sortOrder)), db.select().from(schema.giftCategories)])
      const counts = await giftCounts()
      return {
        name: 'Presentes',
        table: {
          headers: ['Presente', 'Categoria', 'Tipo', 'Valor (R$)', 'Mínimo (R$)', 'Máximo (R$)', 'Disponibilidade', 'Quantidade', 'Dados', 'Esgotado', 'Ativo', 'Destaque'],
          rows: gifts.map((g) => [
            g.name,
            cats.find((c) => c.id === g.categoryId)?.name,
            g.priceType === 'fixed' ? 'Valor fixo' : 'Personalizado',
            money(g.amountCents),
            money(g.minCents),
            money(g.maxCents),
            g.availability === 'unique' ? 'Único' : g.availability === 'limited' ? 'Limitado' : 'Múltiplas',
            g.quantity,
            counts.get(g.id)?.approved ?? 0,
            !availabilityOf(g, counts.get(g.id)).available,
            g.isActive && !g.archivedAt,
            g.featured,
          ]),
        },
      }
    }
    case 'pagamentos': {
      const rows = await listPayments({ status: sp.get('status') ?? '', gift: sp.get('gift') ?? '', q: sp.get('q') ?? '', from: sp.get('from') ?? '', to: sp.get('to') ?? '' })
      return {
        name: 'Pagamentos',
        table: {
          headers: ['Data', 'Convidado', 'E-mail', 'Convite', 'Presente', 'Valor (R$)', 'Forma de pagamento', 'Status', 'ID Mercado Pago', 'Aprovado em', 'Mensagem'],
          rows: rows.map(({ p, invitationLabel }) => [
            formatDateTime(p.createdAt),
            p.payerName,
            p.payerEmail,
            invitationLabel,
            p.giftName,
            money(p.amountCents),
            paymentMethodLabel(p.paymentMethod, p.paymentType),
            PAYMENT_LABEL[p.status],
            p.mpPaymentId,
            when(p.approvedAt),
            p.message,
          ]),
        },
      }
    }
    case 'mensagens': {
      const rows = await db
        .select({ m: schema.messages, label: schema.invitations.label })
        .from(schema.messages)
        .leftJoin(schema.invitations, eq(schema.invitations.id, schema.messages.invitationId))
        .orderBy(desc(schema.messages.createdAt))
      const src = { rsvp: 'RSVP', gift: 'Presente', guestbook: 'Livro de mensagens' } as const
      return {
        name: 'Mensagens',
        table: { headers: ['Data', 'Nome', 'Origem', 'Convite', 'Mensagem'], rows: rows.map(({ m, label }) => [formatDateTime(m.createdAt), m.authorName, src[m.source], label, m.content]) },
      }
    }
    case 'modelo-importacao':
      return {
        name: 'Convidados',
        table: {
          headers: ['Convite', 'Tipo', 'Grupo', 'Nome', 'Sobrenome', 'Telefone', 'E-mail', 'Acompanhante', 'Máx. acompanhantes', 'Familiares próximos', 'Observações'],
          rows: [
            ['Família Silva', 'Família', 'Família do noivo', 'João', 'Silva', '(98) 99999-0001', 'joao@exemplo.com', 'não', '', 'sim', ''],
            ['Família Silva', 'Família', 'Família do noivo', 'Maria', 'Silva', '', '', '', '', '', ''],
            ['Beatriz Almeida', 'Individual', 'Amigos', 'Beatriz', 'Almeida', '(98) 99999-0003', '', 'sim', '1', 'não', 'Colega de faculdade'],
          ],
        },
      }
    default:
      return null
  }
}

export async function GET(req: Request, ctx: RouteContext<'/api/admin/export/[entity]'>) {
  const admin = await getAdmin()
  if (!admin) return new Response('Não autorizado', { status: 401 })
  const { entity } = await ctx.params
  const sp = new URL(req.url).searchParams
  const result = await build(entity, sp)
  if (!result) return new Response('Não encontrado', { status: 404 })
  const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx'
  const day = new Date().toISOString().slice(0, 10)
  await audit(admin.id, 'export', entity, null, { format })
  if (format === 'csv') {
    return new Response(toCsv(result.table), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${entity}-${day}.csv"`, 'Cache-Control': 'no-store' },
    })
  }
  return new Response(new Uint8Array(await toXlsx(result.name, result.table)), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${entity}-${day}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
