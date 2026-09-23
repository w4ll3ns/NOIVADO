import type { Metadata } from 'next'
import { Divider } from '@/components/ornaments/Ornaments'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Aviso de privacidade' }

export default async function PrivacyPage() {
  const settings = await getSettings()
  const p = settings.privacy
  const contact = p.contactEmail || (settings.event.contactPhone ? `WhatsApp ${settings.event.contactPhone}` : 'os próprios noivos')
  return (
    <div className="container">
      <header className="page-head">
        <span className="eyebrow">LGPD</span>
        <h1 className="section-title">Aviso de privacidade</h1>
        <Divider />
        <p className="section-lead">Cuidamos dos seus dados com o mesmo carinho com que preparamos este convite.</p>
      </header>
      <article className="prose" style={{ paddingBottom: 'var(--section-y)' }}>
        <p>
          Este site existe para organizar o noivado de {settings.event.coupleNames}. Os responsáveis pelos dados
          (controladores) são <strong>{p.controllerName}</strong>. Para qualquer pedido sobre seus dados, fale com {contact}.
        </p>

        <h2>Quais dados usamos e por quê</h2>
        <ul>
          <li>
            <strong>Nome, telefone e e-mail</strong> cadastrados pelos noivos — para enviar o seu convite e reconhecê-lo quando você abre o seu link.
          </li>
          <li>
            <strong>Confirmação de presença</strong> e, se você quiser informar, restrições alimentares, necessidades especiais, música e observações —
            para preparar a recepção. Essas informações são opcionais e usadas apenas para o evento.
          </li>
          <li>
            <strong>Presentes</strong>: nome, e-mail, telefone (opcional), valor e mensagem. O pagamento é feito no ambiente seguro do Mercado Pago;
            <strong> não recebemos nem guardamos dados de cartão</strong>. Guardamos apenas o identificador e o status do pagamento.
          </li>
          <li>
            <strong>Mensagens</strong> enviadas aos noivos — lidas somente por eles.
          </li>
          <li>
            <strong>Fotos do álbum</strong> e, se você quiser, seu nome. As fotos podem ser armazenadas e exibidas no álbum do evento
            (privado ou público, conforme a configuração dos noivos, normalmente após aprovação). Seu nome só aparece junto da foto se você autorizar.
            As versões exibidas no site não carregam a localização (GPS) da foto.
          </li>
          <li>
            <strong>Registros de acesso ao link do convite</strong> (data, hora e quantidade de acessos) — para saber se o link chegou até você.
            Um link pode ser encaminhado; por isso registramos apenas que o link foi acessado, e não quem o acessou.
          </li>
          <li>
            <strong>Segurança</strong>: o endereço IP é transformado em um código irreversível apenas para evitar abusos (por exemplo, envios em excesso).
          </li>
        </ul>

        <h2>Cookies e armazenamento no aparelho</h2>
        <ul>
          <li>Um cookie técnico lembra o seu convite neste aparelho, para você não precisar se identificar de novo.</li>
          <li>O navegador guarda se você já viu a abertura do casarão, para não repeti-la a cada visita.</li>
          <li>Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros.</li>
        </ul>

        <h2>Com quem compartilhamos</h2>
        <p>
          Apenas com quem é necessário para o site funcionar: o Mercado Pago (pagamentos dos presentes) e o provedor de hospedagem.
          Telefones, e-mails, confirmações, pagamentos e históricos nunca são exibidos publicamente.
        </p>

        <h2>Por quanto tempo</h2>
        <p>
          Os dados são mantidos até 12 meses após o evento e depois excluídos ou anonimizados — exceto registros de pagamento que precisem
          ser guardados por obrigação legal. As fotos do álbum podem ser guardadas pelos noivos como recordação.
        </p>

        <h2>Seus direitos</h2>
        <p>
          Você pode pedir a qualquer momento acesso, correção ou exclusão dos seus dados, ou a retirada de uma foto do álbum,
          falando com {contact}.
        </p>
        {p.extra ? <p style={{ whiteSpace: 'pre-line' }}>{p.extra}</p> : null}
      </article>
    </div>
  )
}
