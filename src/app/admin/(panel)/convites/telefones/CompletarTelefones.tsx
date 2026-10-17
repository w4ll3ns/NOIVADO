'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { BotaoAgenda, useAgendaDisponivel } from '@/components/admin/Agenda'
import { formatPhone, normalizePhone } from '@/lib/format'
import { lerVcard, sugerirContatos, type Contato } from '@/lib/vcard'
import { salvarTelefoneAction, type TelefoneState } from './actions'

export type ConviteSemTelefone = { id: string; label: string; pessoas: { id: string; firstName: string; lastName: string | null }[] }

export function CompletarTelefones({ convites }: { convites: ConviteSemTelefone[] }) {
  const [contatos, setContatos] = useState<Contato[] | null>(null)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const agenda = useAgendaDisponivel()

  const carregar = async (file: File | undefined) => {
    setErroArquivo(null)
    if (!file) return
    try {
      const lidos = lerVcard(await file.text())
      if (!lidos.length) return setErroArquivo('Não achei contatos com telefone neste arquivo. Ele precisa ser um .vcf exportado da agenda.')
      setContatos(lidos)
    } catch {
      setErroArquivo('Não consegui ler este arquivo. Exporte a agenda de novo em .vcf.')
    }
  }

  return (
    <>
      <section className="a-card">
        <h2 className="a-card__title">Usar a agenda do celular</h2>
        {agenda ? <p>Neste celular, toque em “Da agenda” ao lado de cada pessoa e escolha o contato.</p> : null}
        <p>
          Carregue a agenda exportada (.vcf) e o painel sugere o número de cada pessoa pelo nome. <strong>O arquivo fica só neste aparelho</strong>: é lido
          aqui mesmo e só os números que você salvar são gravados.
        </p>
        <label className="a-field" style={{ marginTop: 10 }}>
          <span>Arquivo da agenda (.vcf)</span>
          <input className="a-input" type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={(e) => void carregar(e.target.files?.[0])} />
        </label>
        {contatos ? (
          <p className="a-alert a-alert--ok" style={{ marginTop: 10 }}>
            {contatos.length} contatos com telefone carregados. As sugestões aparecem embaixo de cada pessoa.
          </p>
        ) : null}
        {erroArquivo ? (
          <p className="a-alert a-alert--bad" style={{ marginTop: 10 }}>
            {erroArquivo}
          </p>
        ) : null}
        <details style={{ marginTop: 10 }}>
          <summary className="a-help" style={{ cursor: 'pointer' }}>
            Como exportar a agenda
          </summary>
          <div className="a-help a-agenda-ajuda">
            <p>
              <strong>iPhone</strong> (iOS 16 ou mais novo): app Contatos → toque em “Listas” → toque e segure em “Todos os Contatos” → Exportar → Salvar em
              Arquivos. Depois, aqui, toque em “Escolher arquivo” e selecione o arquivo salvo.
            </p>
            <p>
              <strong>Android</strong>: no Chrome, o botão “Da agenda” já abre os contatos. Para o arquivo: app Contatos → Corrigir e gerenciar (ou
              Configurações) → Exportar para arquivo.
            </p>
            <p>
              <strong>Um número só</strong>: no app Contatos, toque e segure o número → Copiar, e cole no campo da pessoa.
            </p>
          </div>
        </details>
      </section>

      {convites.length ? (
        convites.map((c) => (
          <section key={c.id} id={`c-${c.id}`} className="a-card a-tel-convite">
            <h3 className="a-tel-convite__titulo">
              <Link href={`/admin/convites/${c.id}`}>{c.label}</Link>
            </h3>
            {c.pessoas.map((p) => (
              <LinhaPessoa key={p.id} pessoa={p} contatos={contatos} />
            ))}
          </section>
        ))
      ) : (
        <p className="a-alert a-alert--ok" style={{ marginTop: 14 }}>
          Todos os convites têm telefone para contato. 🎉
        </p>
      )}
    </>
  )
}

function LinhaPessoa({ pessoa, contatos }: { pessoa: ConviteSemTelefone['pessoas'][number]; contatos: Contato[] | null }) {
  const salvar = useMemo(() => salvarTelefoneAction.bind(null, pessoa.id), [pessoa.id])
  const [state, action, pending] = useActionState<TelefoneState, FormData>(salvar, {})
  const [valor, setValor] = useState('')
  const sugestoes = useMemo(() => (contatos ? sugerirContatos(pessoa, contatos) : []), [contatos, pessoa])
  const nome = [pessoa.firstName, pessoa.lastName].filter(Boolean).join(' ')
  const valido = !!normalizePhone(valor)
  const salvo = state.salvo && normalizePhone(valor) === state.salvo

  return (
    <form action={action} className="a-tel-pessoa">
      <label className="a-field a-tel-pessoa__campo">
        <span>{nome}</span>
        <input
          className="a-input"
          name="telefone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(98) 99999-9999"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </label>
      <div className="a-tel-pessoa__acoes">
        <BotaoAgenda onEscolher={(t) => setValor(formatPhone(t))} />
        <button className="a-btn a-btn--sm a-btn--primary" disabled={!valido || pending || !!salvo}>
          {pending ? 'Salvando…' : salvo ? 'Salvo ✓' : 'Salvar'}
        </button>
      </div>
      {sugestoes.length ? (
        <div className="a-tel-pessoa__sugestoes">
          <span className="a-help">Da agenda:</span>
          {sugestoes.flatMap((c) =>
            c.telefones.map((t) => (
              <button key={`${c.nome}-${t}`} type="button" className="a-chip" onClick={() => setValor(formatPhone(t))}>
                {c.nome} · {formatPhone(t)}
              </button>
            )),
          )}
        </div>
      ) : null}
      {state.error ? <p className="a-alert a-alert--bad">{state.error}</p> : null}
    </form>
  )
}
