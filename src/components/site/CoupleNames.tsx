import { coupleParts } from '@/lib/event'

/** "Maby & Chris" → "Maby e Chris", como no Save the Date (o "&" da caligrafia parece um "@"). */
export function CoupleNames({ names }: { names: string }) {
  const parts = coupleParts(names)
  if (!parts) return <>{names}</>
  return (
    <>
      {parts.a} <span className="amp">{parts.joiner === '&' ? 'e' : parts.joiner}</span> {parts.b}
    </>
  )
}
