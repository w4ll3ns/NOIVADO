'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type WallPhoto = { id: string; thumb: string; full: string; width: number; height: number; color: string | null; caption: string | null }

type Props = {
  initial: WallPhoto[]
  nextCursor?: string | null
  /** Endpoint JSON para "carregar mais" (fotos do álbum). */
  moreUrl?: string
  label: string
}

type ApiPhoto = { id: string; width: number; height: number; color: string | null; name: string | null }

export function PhotoWall({ initial, nextCursor: initialCursor = null, moreUrl, label }: Props) {
  const [photos, setPhotos] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (!moreUrl || !cursor || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${moreUrl}?cursor=${encodeURIComponent(cursor)}`)
      const data = (await res.json()) as { photos: ApiPhoto[]; nextCursor: string | null }
      setPhotos((list) => [
        ...list,
        ...data.photos.map((p) => ({ id: p.id, thumb: `/p/${p.id}/thumb`, full: `/p/${p.id}/web`, width: p.width, height: p.height, color: p.color, caption: p.name })),
      ])
      setCursor(data.nextCursor)
    } finally {
      setLoading(false)
    }
  }, [moreUrl, cursor, loading])

  // Carregamento progressivo ao chegar perto do fim.
  useEffect(() => {
    if (!cursor || !sentinel.current || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void loadMore(), { rootMargin: '600px' })
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [cursor, loadMore])

  return (
    <>
      <div className="masonry" aria-label={label}>
        {photos.map((p, i) => (
          <button key={p.id} type="button" className="masonry__item" onClick={() => setOpen(i)} aria-label={`Abrir foto ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.thumb}
              alt=""
              width={p.width}
              height={p.height}
              loading={i < 6 ? 'eager' : 'lazy'}
              decoding="async"
              style={{ backgroundColor: p.color ?? undefined, aspectRatio: `${p.width} / ${p.height}` }}
            />
            {p.caption ? <span className="masonry__caption">{p.caption}</span> : null}
          </button>
        ))}
      </div>
      <div ref={sentinel} />
      {cursor ? (
        <p className="center" style={{ marginTop: 20 }}>
          <button type="button" className="btn" onClick={() => void loadMore()} disabled={loading}>
            {loading ? 'Carregando…' : 'Ver mais fotos'}
          </button>
        </p>
      ) : null}
      {open !== null ? (
        <Lightbox
          photos={photos}
          index={open}
          onIndex={(i) => {
            setOpen(i)
            if (i >= photos.length - 3) void loadMore()
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  )
}

function Lightbox({ photos, index, onIndex, onClose }: { photos: WallPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const photo = photos[index]
  const prev = () => index > 0 && onIndex(index - 1)
  const next = () => index < photos.length - 1 && onIndex(index + 1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  })

  // Pré-carrega a próxima.
  useEffect(() => {
    const n = photos[index + 1]
    if (n) {
      const img = new Image()
      img.src = n.full
    }
  }, [index, photos])

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Foto em tela cheia"
      onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        if (!start.current) return
        const dx = e.clientX - start.current.x
        const dy = e.clientY - start.current.y
        start.current = null
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx > 0 ? prev : next)()
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={photo.id} src={photo.full} alt={photo.caption ?? ''} style={{ backgroundColor: photo.color ?? undefined }} />
      <button type="button" className="lightbox__btn lightbox__close" onClick={onClose} aria-label="Fechar">
        ×
      </button>
      {index > 0 ? (
        <button type="button" className="lightbox__btn lightbox__prev" onClick={prev} aria-label="Foto anterior">
          ‹
        </button>
      ) : null}
      {index < photos.length - 1 ? (
        <button type="button" className="lightbox__btn lightbox__next" onClick={next} aria-label="Próxima foto">
          ›
        </button>
      ) : null}
      <p className="lightbox__caption">
        {photo.caption ? `${photo.caption} · ` : ''}
        {index + 1} / {photos.length}
      </p>
    </div>
  )
}
