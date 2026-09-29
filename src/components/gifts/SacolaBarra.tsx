'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { formatBRLShort } from '@/lib/format'
import { assinarSacola, sacola, sacolaNoServidor } from './sacola'

export type Precos = Record<string, { cents: number | null; livre: boolean }>

/** Barra fixa no rodapé da lista: quantos presentes foram escolhidos, o total e "Finalizar presentes". */
export function SacolaBarra({ precos }: { precos: Precos }) {
  const itens = useSyncExternalStore(assinarSacola, sacola, sacolaNoServidor).filter((i) => precos[i.id])
  if (!itens.length) return null
  const total = itens.reduce((s, i) => s + ((precos[i.id].livre ? i.cents : precos[i.id].cents) ?? 0), 0)
  const semValor = itens.some((i) => precos[i.id].livre && !i.cents)
  return (
    <div className="sacola-barra" role="region" aria-label="Seus presentes">
      <div className="sacola-barra__info" aria-live="polite">
        <span className="sacola-barra__qtd">
          {itens.length === 1 ? '1 presente' : `${itens.length} presentes`}
        </span>
        <span className="sacola-barra__total">
          {total ? formatBRLShort(total) : null}
          {semValor ? <span className="sacola-barra__livre">{total ? ' + valor livre' : 'Valor livre'}</span> : null}
        </span>
      </div>
      <Link href="/presentes/finalizar" className="btn btn--primary sacola-barra__btn">
        Finalizar presentes
      </Link>
    </div>
  )
}
