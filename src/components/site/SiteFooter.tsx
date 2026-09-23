import Link from 'next/link'
import { Facade } from '@/components/casarao/Facade'
import { Divider } from '@/components/ornaments/Ornaments'
import { CoupleNames } from './CoupleNames'

export function SiteFooter({ coupleNames, dateDots, monogram, showGuestbook }: { coupleNames: string; dateDots: string; monogram: string; showGuestbook: boolean }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <Facade idPrefix="footer" className="cz--small" monogram={monogram} />
        <p className="site-footer__names script">
          <CoupleNames names={coupleNames} />
        </p>
        <p className="site-footer__date">{dateDots}</p>
        <Divider />
        <nav className="site-footer__links" aria-label="Rodapé">
          {showGuestbook ? <Link href="/mensagens">Livro de mensagens</Link> : null}
          <Link href="/galeria">Galeria</Link>
          <Link href="/?abertura=1">Rever a abertura</Link>
          <Link href="/privacidade">Privacidade</Link>
        </nav>
        <p className="site-footer__small">Feito com carinho no Centro Histórico de São Luís.</p>
      </div>
    </footer>
  )
}
