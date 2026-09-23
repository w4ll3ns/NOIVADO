import { coupleParts } from '@/lib/event'

/** "Maby & Chris" com o "&" em tamanho menor, como no Save the Date. */
export function CoupleNames({ names }: { names: string }) {
  const parts = coupleParts(names)
  if (!parts) return <>{names}</>
  return (
    <>
      {parts.a} <span className="amp">{parts.joiner === '&' ? '&' : parts.joiner}</span> {parts.b}
    </>
  )
}
