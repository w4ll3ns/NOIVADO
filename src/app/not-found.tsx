import Link from 'next/link'
import { Crest, Divider } from '@/components/ornaments/Ornaments'

export default function NotFound() {
  return (
    <main className="container narrow" style={{ minHeight: '80svh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <Crest />
        <p className="script" style={{ fontSize: 'var(--fs-script-md)', marginTop: 10 }}>
          Esta porta não abre
        </p>
        <Divider />
        <p className="section-lead">A página que você procura não existe ou mudou de lugar.</p>
        <p style={{ marginTop: 24 }}>
          <Link href="/" className="btn btn--primary">
            Voltar ao início
          </Link>
        </p>
      </div>
    </main>
  )
}
