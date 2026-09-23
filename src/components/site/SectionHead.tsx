import { Divider } from '@/components/ornaments/Ornaments'

export function SectionHead({ eyebrow, title, lead, caps }: { eyebrow?: string; title: string; lead?: string | null; caps?: boolean }) {
  return (
    <div className="section-head">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2 className={caps ? 'section-title section-title--caps' : 'section-title'}>{title}</h2>
      <Divider />
      {lead ? <p className="section-lead">{lead}</p> : null}
    </div>
  )
}
