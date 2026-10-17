'use client'

import { useActionState, useState } from 'react'
import { excluirTudoAction, type ExcluirTudoState } from './actions'

const FRASE = 'EXCLUIR TUDO'

const n = (qtd: number, um: string, varios: string) => `${qtd} ${qtd === 1 ? um : varios}`

export type ResumoExclusao = { convites: number; pessoas: number; enviados: number; respondidos: number; arquivados: number }

/** Importou errado? Exclui todos os convites para importar de novo (só o dono, com confirmação digitada). */
export function ExcluirTudo({ resumo }: { resumo: ResumoExclusao }) {
  const [state, action, pending] = useActionState<ExcluirTudoState, FormData>(excluirTudoAction, {})
  const [texto, setTexto] = useState('')
  const pronto = texto.trim().replace(/\s+/g, ' ').toUpperCase() === FRASE

  if (state.done) {
    return (
      <section className="a-card" id="excluir-tudo">
        <p className="a-alert a-alert--ok">
          Pronto: {n(state.done.invitations, 'convite', 'convites')} e {n(state.done.guests, 'pessoa', 'pessoas')} excluídos. Já pode importar a planilha de
          novo, acima.
        </p>
      </section>
    )
  }
  if (!resumo.convites) return null

  return (
    <section className="a-card a-card--perigo" id="excluir-tudo">
      <h2 className="a-card__title">Começar do zero</h2>
      <p>Importou algo errado? Exclua todos os convites e importe a planilha de novo.</p>
      <ul className="a-lista-perigo">
        <li>
          Serão excluídos <strong>{n(resumo.convites, 'convite', 'convites')}</strong> e <strong>{n(resumo.pessoas, 'pessoa', 'pessoas')}</strong>
          {resumo.arquivados ? `, inclusive ${n(resumo.arquivados, 'arquivado', 'arquivados')}` : ''}.
        </li>
        {resumo.enviados ? (
          <li>
            {resumo.enviados === 1 ? (
              <>
                <strong>1 convite</strong> já foi enviado: esse link para de funcionar.
              </>
            ) : (
              <>
                <strong>{resumo.enviados} convites</strong> já foram enviados: esses links param de funcionar.
              </>
            )}
          </li>
        ) : null}
        {resumo.respondidos ? (
          <li>
            {resumo.respondidos === 1 ? (
              <>
                <strong>1 convite</strong> já respondeu a presença: a resposta será perdida.
              </>
            ) : (
              <>
                <strong>{resumo.respondidos} convites</strong> já responderam a presença: as respostas serão perdidas.
              </>
            )}
          </li>
        ) : null}
        <li>Pagamentos de presentes, recados e fotos continuam no painel.</li>
      </ul>
      <form action={action} className="a-form" style={{ marginTop: 12 }}>
        <label className="a-field">
          <span>
            Para confirmar, digite <strong>{FRASE}</strong>
          </span>
          <input className="a-input" name="confirmacao" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        {state.error ? <p className="a-alert a-alert--bad">{state.error}</p> : null}
        <div className="a-actions">
          <button className="a-btn a-btn--danger" disabled={!pronto || pending}>
            {pending ? 'Excluindo…' : resumo.convites === 1 ? 'Excluir o convite' : `Excluir os ${resumo.convites} convites`}
          </button>
        </div>
      </form>
    </section>
  )
}
