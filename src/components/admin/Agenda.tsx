'use client'

import { useEffect, useState } from 'react'
import { formatPhone, normalizePhone } from '@/lib/format'

/** Contact Picker API (Chrome no Android). O iPhone não deixa sites abrirem a agenda. */
type ContactsManager = { select: (props: string[], opts?: { multiple?: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> }

function picker(): ContactsManager | null {
  if (typeof navigator === 'undefined' || typeof window === 'undefined' || !('ContactsManager' in window)) return null
  return (navigator as unknown as { contacts?: ContactsManager }).contacts ?? null
}

/** Este aparelho deixa abrir a agenda? (só depois de montar, para não divergir do HTML do servidor) */
export function useAgendaDisponivel() {
  const [ok, setOk] = useState(false)
  useEffect(() => setOk(!!picker()), [])
  return ok
}

/**
 * "Da agenda": abre a agenda do celular e devolve o número escolhido (já normalizado). Se o contato
 * tiver mais de um número, mostra as opções.
 */
export function BotaoAgenda({ onEscolher, className = 'a-btn a-btn--sm' }: { onEscolher: (telefone: string, nome: string) => void; className?: string }) {
  const disponivel = useAgendaDisponivel()
  const [opcoes, setOpcoes] = useState<{ nome: string; telefones: string[] } | null>(null)
  if (!disponivel) return null
  const abrir = async () => {
    try {
      const [c] = await picker()!.select(['name', 'tel'], { multiple: false })
      if (!c) return
      const nome = c.name?.[0] ?? ''
      const telefones = [...new Set((c.tel ?? []).map((t) => normalizePhone(t)).filter((t): t is string => !!t))]
      if (telefones.length === 1) onEscolher(telefones[0], nome)
      else if (telefones.length > 1) setOpcoes({ nome, telefones })
    } catch {
      /* o convidado cancelou ou o navegador recusou */
    }
  }
  return (
    <>
      <button type="button" className={className} onClick={() => void abrir()}>
        Da agenda
      </button>
      {opcoes ? (
        <span className="a-agenda-opcoes">
          {opcoes.telefones.map((t) => (
            <button
              key={t}
              type="button"
              className="a-btn a-btn--sm"
              onClick={() => {
                onEscolher(t, opcoes.nome)
                setOpcoes(null)
              }}
            >
              {formatPhone(t)}
            </button>
          ))}
        </span>
      ) : null}
    </>
  )
}
