import type { InvitationKind } from '@/lib/db/schema'
import { normalizePhone } from '@/lib/format'

export type ImportInvitation = {
  label: string
  kind: InvitationKind
  groupName: string | null
  phone: string | null
  email: string | null
  allowCompanions: boolean
  maxCompanions: number
  isCloseFamily: boolean
  notes: string | null
  guests: { firstName: string; lastName: string | null; phone: string | null; email: string | null }[]
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const HEADER_MAP: Record<string, string> = {
  convite: 'label',
  'nome do convite': 'label',
  familia: 'label',
  'grupo familia': 'label',
  tipo: 'kind',
  grupo: 'group',
  categoria: 'group',
  nome: 'firstName',
  'primeiro nome': 'firstName',
  sobrenome: 'lastName',
  telefone: 'phone',
  celular: 'phone',
  whatsapp: 'phone',
  email: 'email',
  'e mail': 'email',
  acompanhante: 'companions',
  'pode levar acompanhante': 'companions',
  'max acompanhantes': 'maxCompanions',
  'quantidade maxima': 'maxCompanions',
  'maximo de acompanhantes': 'maxCompanions',
  'familiares proximos': 'closeFamily',
  observacoes: 'notes',
  obs: 'notes',
}

const yes = (v: string) => ['sim', 's', 'yes', 'y', 'x', '1', 'true', 'verdadeiro'].includes(norm(v))

function kindFrom(v: string, count: number): InvitationKind {
  const k = norm(v)
  if (k.startsWith('indiv')) return 'individual'
  if (k.startsWith('casal') || k === 'couple') return 'couple'
  if (k.startsWith('famil')) return 'family'
  if (k.startsWith('grupo') || k === 'group') return 'group'
  return count <= 1 ? 'individual' : count === 2 ? 'couple' : 'family'
}

/** Converte linhas (1ª = cabeçalho) em convites; linhas com o mesmo "Convite" formam um só convite. */
export function buildImport(rows: string[][]): { invitations: ImportInvitation[]; errors: string[] } {
  const errors: string[] = []
  if (rows.length < 2) return { invitations: [], errors: ['A planilha precisa de um cabeçalho e pelo menos uma linha.'] }
  const header = rows[0].map((h) => HEADER_MAP[norm(h)] ?? null)
  if (!header.includes('firstName')) return { invitations: [], errors: ['Coluna “Nome” não encontrada no cabeçalho.'] }
  const map = new Map<string, ImportInvitation & { kindRaw: string }>()
  rows.slice(1).forEach((r, idx) => {
    const get = (key: string) => {
      const i = header.indexOf(key)
      return i >= 0 ? (r[i] ?? '').trim() : ''
    }
    const firstName = get('firstName')
    const lastName = get('lastName')
    if (!firstName) {
      errors.push(`Linha ${idx + 2}: sem nome — ignorada.`)
      return
    }
    const label = get('label') || [firstName, lastName].filter(Boolean).join(' ')
    const key = norm(label)
    const rawPhone = get('phone')
    const phone = rawPhone ? normalizePhone(rawPhone) : null
    if (rawPhone && !phone) errors.push(`Linha ${idx + 2}: telefone “${rawPhone}” inválido — deixado em branco.`)
    const email = get('email').toLowerCase() || null
    let inv = map.get(key)
    if (!inv) {
      inv = {
        label: label.slice(0, 120),
        kind: 'individual',
        kindRaw: get('kind'),
        groupName: get('group') || null,
        phone: null,
        email: null,
        allowCompanions: yes(get('companions')),
        maxCompanions: 0,
        isCloseFamily: yes(get('closeFamily')),
        notes: get('notes') || null,
        guests: [],
      }
      map.set(key, inv)
    }
    inv.phone ??= phone
    inv.email ??= email
    const max = Number(get('maxCompanions'))
    if (inv.allowCompanions) inv.maxCompanions = Math.max(inv.maxCompanions, Number.isFinite(max) && max > 0 ? Math.min(10, max) : 1)
    inv.guests.push({ firstName: firstName.slice(0, 60), lastName: lastName.slice(0, 80) || null, phone, email })
  })
  const invitations = [...map.values()].map(({ kindRaw, ...inv }) => ({ ...inv, kind: kindFrom(kindRaw, inv.guests.length) }))
  return { invitations, errors }
}
