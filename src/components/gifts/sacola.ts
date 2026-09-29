/**
 * "Seus presentes": os presentes escolhidos na lista, guardados no aparelho (localStorage) até o
 * convidado finalizar. `cents` só importa nos presentes de valor livre (null = ainda não definido).
 */

export type ItemSacola = { id: string; cents: number | null }

/** Igual ao limite do servidor (MAX_ORDER_ITEMS em lib/payments/service). */
export const MAX_ITENS = 20

const CHAVE = 'mc-sacola'
const UUID = /^[0-9a-f-]{36}$/i

let itens: ItemSacola[] | null = null
const ouvintes = new Set<() => void>()
const VAZIA: ItemSacola[] = []

function ler(): ItemSacola[] {
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? '[]')
    if (!Array.isArray(bruto)) return []
    return bruto
      .filter((x): x is ItemSacola => !!x && typeof x.id === 'string' && UUID.test(x.id))
      .map((x) => ({ id: x.id, cents: typeof x.cents === 'number' && Number.isInteger(x.cents) && x.cents > 0 ? x.cents : null }))
      .slice(0, MAX_ITENS)
  } catch {
    return []
  }
}

function salvar(novos: ItemSacola[]) {
  itens = novos
  try {
    if (novos.length) localStorage.setItem(CHAVE, JSON.stringify(novos))
    else localStorage.removeItem(CHAVE)
  } catch {
    /* modo privado: vale só nesta página */
  }
  ouvintes.forEach((f) => f())
}

export function sacola(): ItemSacola[] {
  if (typeof window === 'undefined') return VAZIA
  if (itens === null) itens = ler()
  return itens
}

export const sacolaNoServidor = () => VAZIA

export function assinarSacola(fn: () => void) {
  ouvintes.add(fn)
  // Outra aba mexeu na sacola: relê.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CHAVE) return
    itens = ler()
    fn()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    ouvintes.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

export function naSacola(id: string) {
  return sacola().some((i) => i.id === id)
}

/** false quando a sacola já está cheia. */
export function escolher(id: string, cents: number | null = null) {
  const atual = sacola()
  if (atual.some((i) => i.id === id)) return true
  if (atual.length >= MAX_ITENS) return false
  salvar([...atual, { id, cents }])
  return true
}

export function tirar(id: string) {
  salvar(sacola().filter((i) => i.id !== id))
}

export function definirValor(id: string, cents: number | null) {
  salvar(sacola().map((i) => (i.id === id ? { ...i, cents } : i)))
}

export function substituirSacola(novos: ItemSacola[]) {
  salvar(novos.slice(0, MAX_ITENS))
}

export function esvaziarSacola() {
  salvar([])
}
