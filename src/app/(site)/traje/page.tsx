import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Divider } from '@/components/ornaments/Ornaments'
import { DressCode } from '@/components/site/DressCode'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Dress Code' }

export default async function DressCodePage() {
  const settings = await getSettings()
  if (!settings.dressCode.enabled) notFound()
  return (
    <div className="container">
      <header className="page-head">
        <span className="eyebrow">Traje</span>
        <h1 className="section-title">Dress Code</h1>
        <Divider />
      </header>
      <div style={{ paddingBottom: 'var(--section-y)' }}>
        <DressCode dress={settings.dressCode} />
        <div className="btn-row" style={{ marginTop: 44 }}>
          <Link href="/#localizacao" className="btn">
            Voltar
          </Link>
        </div>
      </div>
    </div>
  )
}
