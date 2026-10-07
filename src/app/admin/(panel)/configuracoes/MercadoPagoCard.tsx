import { mercadoPagoStatus } from '@/lib/payments/service'

/** Configurações → Presentes: a qual conta do Mercado Pago o site está ligado e o que o checkout aceita. */
export async function MercadoPagoCard() {
  const s = await mercadoPagoStatus()
  return (
    <section className="a-card mp-card" style={{ marginBottom: 16 }}>
      <h2 className="a-card__title">
        <span>Mercado Pago</span>
        {s.connected ? (
          <span className={`a-badge ${s.production ? 'a-badge--ok' : 'a-badge--warn'}`}>{s.production ? 'Conectado' : 'Conectado (teste)'}</span>
        ) : (
          <span className={`a-badge ${s.reason === 'sem_token' ? 'a-badge--warn' : 'a-badge--bad'}`}>
            {s.reason === 'sem_token' ? 'Não conectado' : s.reason === 'token_recusado' ? 'Token recusado' : 'Sem resposta'}
          </span>
        )}
      </h2>

      {!s.connected ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {s.reason === 'sem_token' ? (
            <p>
              Enquanto o Mercado Pago não estiver conectado, quem tenta presentear vê o aviso “Os presentes estarão disponíveis em breve”.
            </p>
          ) : s.reason === 'token_recusado' ? (
            <p className="a-alert a-alert--bad">
              O Mercado Pago não aceitou o Access Token salvo no servidor. Copie de novo o Access Token de produção e rode o comando abaixo.
            </p>
          ) : (
            <p className="a-alert a-alert--warn">
              Não consegui falar com o Mercado Pago agora{s.detail ? ` (${s.detail})` : ''}. Recarregue esta página em instantes.
            </p>
          )}
          {s.reason !== 'sem_conexao' ? (
            <p>
              Para conectar, no terminal da VPS: <code>cd /opt/noivado &amp;&amp; ./scripts/mercadopago.sh</code>
            </p>
          ) : null}
        </div>
      ) : (
        <dl className="mp-card__dados">
          <div>
            <dt>Conta</dt>
            <dd>
              {s.account.nickname ?? '—'}
              {s.account.email ? ` · ${s.account.email}` : ''}
            </dd>
          </div>
          <div>
            <dt>Pagamento</dt>
            <dd>
              {s.onSite ? 'Pix no próprio site (QR Code e copia e cola); cartão de crédito na página do Mercado Pago' : 'Simulação (sem cobrança)'}
            </dd>
          </div>
          <div>
            <dt>Formas</dt>
            <dd>
              Pix e cartão de crédito
              {s.cards.length ? <span className="a-help"> ({s.cards.slice(0, 6).join(', ')})</span> : null}
              {s.pix === false ? (
                <p className="a-alert a-alert--warn" style={{ marginTop: 8 }}>
                  O Pix não aparece para esta conta. Cadastre uma chave Pix na conta do Mercado Pago para gerar o Pix no site.
                </p>
              ) : (
                <p className="a-help">O Pix só aparece se a conta tiver uma chave Pix cadastrada.</p>
              )}
            </dd>
          </div>
          <div>
            <dt>Notificações</dt>
            <dd>
              {s.webhookSecret ? (
                <span className="a-badge a-badge--ok">Assinatura conferida</span>
              ) : (
                <p className="a-alert a-alert--warn">
                  Falta a assinatura secreta do webhook. Os pagamentos continuam sendo confirmados (o site consulta o Mercado Pago), mas com
                  ela a confirmação chega na hora e com verificação.
                </p>
              )}
              <p className="a-help" style={{ marginTop: 6 }}>
                URL no Mercado Pago (evento “Pagamentos”): <code>{s.webhookUrl}</code>
              </p>
            </dd>
          </div>
          {!s.production ? (
            <p className="a-alert a-alert--warn">
              Estas são credenciais de teste: nenhum pagamento é real. Para receber de verdade, use o Access Token de produção (começa com APP_USR-).
            </p>
          ) : null}
          {!s.httpsOk ? <p className="a-alert a-alert--bad">O endereço do site não está em https: o Mercado Pago não envia as notificações.</p> : null}
        </dl>
      )}
    </section>
  )
}
