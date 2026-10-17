import type { InvitationKind } from '@/lib/db/schema'
import { joinNames, normalizePhone } from '@/lib/format'

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

/**
 * "Família 3", "Grupo 2", "Convite 7", "12": só servem para juntar as pessoas na planilha. O convite
 * recebe o nome das pessoas ("Edson e Jordania") e esse rótulo não aparece em lugar nenhum.
 */
const isPlaceholder = (v: string) => /^(fam[ií]lia|grupo|convite|casal|n[uú]cleo)?\s*(n[º°o]?\.?\s*)?#?\d+$/i.test(v.trim())

const yes = (v: string) => ['sim', 's', 'yes', 'y', 'x', '1', 'true', 'verdadeiro'].includes(norm(v))

function kindFrom(v: string, count: number): InvitationKind {
  const k = norm(v)
  if (k.startsWith('indiv')) return 'individual'
  if (k.startsWith('casal') || k === 'couple') return 'couple'
  if (k.startsWith('famil')) return 'family'
  if (k.startsWith('grupo') || k === 'group') return 'group'
  return count <= 1 ? 'individual' : count === 2 ? 'couple' : 'family'
}

/**
 * Converte linhas (1ª = cabeçalho) em convites. Linhas com o mesmo "Convite" formam um só convite (um
 * link para todos, cada pessoa com o seu telefone); linhas do tipo "Individual" nunca se juntam, mesmo
 * com nomes iguais (duas "Manu" são duas pessoas).
 */
export function buildImport(rows: string[][]): { invitations: ImportInvitation[]; errors: string[] } {
  const errors: string[] = []
  if (rows.length < 2) return { invitations: [], errors: ['A planilha precisa de um cabeçalho e pelo menos uma linha.'] }
  const header = rows[0].map((h) => HEADER_MAP[norm(h)] ?? null)
  if (!header.includes('firstName')) return { invitations: [], errors: ['Coluna “Nome” não encontrada no cabeçalho.'] }
  const map = new Map<string, ImportInvitation & { kindRaw: string; namedByPeople: boolean }>()
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
    const rawLabel = get('label')
    const kindRaw = get('kind')
    const namedByPeople = !rawLabel || isPlaceholder(rawLabel)
    const label = namedByPeople ? [firstName, lastName].filter(Boolean).join(' ') : rawLabel
    // Só junta linhas que dizem o mesmo "Convite" (e não são "Individual").
    const key = rawLabel && !norm(kindRaw).startsWith('indiv') ? `c:${norm(rawLabel)}` : `l:${idx}`
    const rawPhone = get('phone')
    const phone = rawPhone ? normalizePhone(rawPhone) : null
    if (rawPhone && !phone) errors.push(`Linha ${idx + 2}: telefone “${rawPhone}” inválido — deixado em branco.`)
    const email = get('email').toLowerCase() || null
    let inv = map.get(key)
    if (!inv) {
      const group = get('group')
      inv = {
        label: label.slice(0, 120),
        kind: 'individual',
        kindRaw,
        namedByPeople,
        groupName: group && !isPlaceholder(group) ? group : null,
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
  const invitations = [...map.values()].map(({ kindRaw, namedByPeople, ...inv }) => ({
    ...inv,
    // "Família 3" vira "Edson e Jordania" (os primeiros nomes, como o convite é saudado).
    label: namedByPeople && inv.guests.length > 1 ? joinNames(inv.guests.map((g) => g.firstName)).slice(0, 120) : inv.label,
    kind: kindFrom(kindRaw, inv.guests.length),
  }))
  // Nomes iguais em convites diferentes: avisa para conferir (continuam separados).
  const byLabel = new Map<string, ImportInvitation[]>()
  for (const inv of invitations) byLabel.set(norm(inv.label), [...(byLabel.get(norm(inv.label)) ?? []), inv])
  for (const same of byLabel.values()) {
    if (same.length > 1) errors.push(`“${same[0].label}” aparece em ${same.length} convites diferentes: confira os telefones para saber quem é quem.`)
  }
  return { invitations, errors }
}

/** Identifica um convite (nome, pessoas e telefones) para não importar duas vezes o mesmo. */
export function importSignature(inv: { label: string; phone: string | null; guests: { firstName: string; phone: string | null }[] }) {
  const phones = [...new Set([inv.phone, ...inv.guests.map((g) => g.phone)].filter((p): p is string => !!p))].sort()
  const names = inv.guests.map((g) => norm(g.firstName)).sort()
  return `${norm(inv.label)}|${names.join(',')}|${phones.join(',')}`
}
