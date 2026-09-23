import Link from 'next/link'
import { Divider, FrameCorners } from '@/components/ornaments/Ornaments'

export function InvalidInvite({ contactPhone }: { contactPhone?: string }) {
  const phone = contactPhone?.replace(/\D/g, '')
  return (
    <div className="container narrow">
      <header className="page-head">
        <span className="eyebrow">Convite</span>
        <h1 className="section-title">Este link não está ativo</h1>
        <Divider />
      </header>
      <div className="paper paper--ornate center" style={{ marginBottom: 'var(--section-y)' }}>
        <FrameCorners />
        <p className="section-lead">
          Talvez o endereço tenha sido copiado pela metade, ou os noivos enviaram um link novo. Confira a mensagem mais recente que você recebeu.
        </p>
        <div className="btn-row" style={{ marginTop: 24 }}>
          {phone ? (
            <a className="btn btn--primary" href={`https://api.whatsapp.com/send?phone=${phone}`} target="_blank" rel="noopener noreferrer">
              Falar com os noivos
            </a>
          ) : null}
          <Link className="btn" href="/">
            Conhecer o site
          </Link>
        </div>
      </div>
    </div>
  )
}
