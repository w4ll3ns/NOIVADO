'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  token: string
  allowCamera: boolean
  allowGallery: boolean
  allowMultiple: boolean
  requireName: boolean
  requireApproval: boolean
  defaultName: string
  galleryHref: string | null
}

type Item = { id: string; blob: Blob; url: string; fileName: string }
type Mode = 'home' | 'camera' | 'review' | 'uploading' | 'done'

const NAME_KEY = 'mc-album-name'
const SHOW_KEY = 'mc-album-showname'
const MAX_DIRECT_BYTES = 20 * 1024 * 1024
const SAFE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality),
  )
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; w: number; h: number; close?: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() }
    } catch {
      /* tenta pelo <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { source: img, w: img.naturalWidth, h: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Mantém o original sempre que possível. HEIC ou arquivos enormes são convertidos
 * no próprio aparelho para JPEG de alta qualidade (máx. 4096 px).
 */
async function prepare(file: Blob): Promise<Blob> {
  if (SAFE_TYPES.includes(file.type) && file.size <= MAX_DIRECT_BYTES) return file
  try {
    const img = await decode(file)
    const scale = Math.min(1, 4096 / Math.max(img.w, img.h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.w * scale)
    canvas.height = Math.round(img.h * scale)
    canvas.getContext('2d')!.drawImage(img.source, 0, 0, canvas.width, canvas.height)
    img.close?.()
    return await canvasToBlob(canvas, 0.9)
  } catch {
    return file
  }
}

function upload(
  token: string,
  blob: Blob,
  fileName: string,
  fields: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const form = new FormData()
    form.append('file', blob, fileName)
    for (const [k, v] of Object.entries(fields)) form.append(k, v)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/album/${token}/upload`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      let body: { ok?: boolean; error?: string } = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* resposta sem JSON */
      }
      resolve(xhr.status >= 200 && xhr.status < 300 ? { ok: true } : { ok: false, error: body.error ?? 'Não conseguimos enviar esta foto.' })
    }
    xhr.onerror = () => resolve({ ok: false, error: 'Sem conexão. Verifique a internet e tente de novo.' })
    xhr.send(form)
  })
}

export function AlbumCapture(props: Props) {
  const [mode, setMode] = useState<Mode>('home')
  const [items, setItems] = useState<Item[]>([])
  const [source, setSource] = useState<'camera' | 'gallery'>('gallery')
  const [name, setName] = useState(props.defaultName)
  const [showName, setShowName] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ index: 0, total: 0, pct: 0 })
  const [result, setResult] = useState({ sent: 0, failed: 0 })
  const galleryInput = useRef<HTMLInputElement>(null)
  const captureInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY)
      if (saved && !props.defaultName) setName(saved)
      setShowName(localStorage.getItem(SHOW_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [props.defaultName])

  const clearItems = useCallback(() => {
    setItems((list) => {
      list.forEach((i) => URL.revokeObjectURL(i.url))
      return []
    })
  }, [])

  const addBlobs = async (files: Blob[], from: 'camera' | 'gallery') => {
    setError(null)
    const prepared: Item[] = []
    for (const f of files) {
      const blob = await prepare(f)
      const baseName = f instanceof File ? f.name.replace(/\.[^.]+$/, '') : `foto-${Date.now()}`
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
      prepared.push({ id: uid(), blob, url: URL.createObjectURL(blob), fileName: `${baseName}.${ext}` })
    }
    setSource(from)
    setItems((list) => [...list, ...prepared])
    setMode('review')
  }

  const openCamera = () => {
    setError(null)
    const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext
    if (supported) setMode('camera')
    else captureInput.current?.click()
  }

  const retake = () => {
    clearItems()
    if (source === 'camera') openCamera()
    else {
      setMode('home')
      galleryInput.current?.click()
    }
  }

  const send = async () => {
    const trimmed = name.trim()
    if (props.requireName && !trimmed) {
      setError('Conte para nós o seu nome antes de enviar.')
      return
    }
    try {
      if (trimmed) localStorage.setItem(NAME_KEY, trimmed)
      localStorage.setItem(SHOW_KEY, showName ? '1' : '0')
    } catch {
      /* ignore */
    }
    setMode('uploading')
    let sent = 0
    let failed = 0
    let lastError: string | null = null
    for (let i = 0; i < items.length; i++) {
      setProgress({ index: i + 1, total: items.length, pct: 0 })
      const res = await upload(
        props.token,
        items[i].blob,
        items[i].fileName,
        { name: trimmed, showName: showName && trimmed ? '1' : '0', source },
        (pct) => setProgress({ index: i + 1, total: items.length, pct }),
      )
      if (res.ok) sent++
      else {
        failed++
        lastError = res.error ?? null
      }
    }
    setResult({ sent, failed })
    if (sent === 0) {
      setError(lastError ?? 'Não conseguimos enviar. Tente novamente.')
      setMode('review')
      return
    }
    setError(failed ? `${failed} foto(s) não puderam ser enviadas. ${lastError ?? ''}` : null)
    clearItems()
    setMode('done')
  }

  const hiddenInputs = (
    <>
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        multiple={props.allowMultiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, 20)
          e.target.value = ''
          if (files.length) void addBlobs(files, 'gallery')
        }}
      />
      <input
        ref={captureInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, 1)
          e.target.value = ''
          if (files.length) void addBlobs(files, 'camera')
        }}
      />
    </>
  )

  if (mode === 'camera') {
    return (
      <>
        {hiddenInputs}
        <CameraView
          onClose={() => setMode('home')}
          onCapture={(blob) => void addBlobs([blob], 'camera')}
          onUnavailable={(message) => {
            setMode('home')
            setError(message)
            captureInput.current?.click()
          }}
        />
      </>
    )
  }

  if (mode === 'review' || mode === 'uploading') {
    const single = items.length === 1
    const uploading = mode === 'uploading'
    return (
      <div className="review" role="dialog" aria-modal="true" aria-label="Conferir foto">
        {hiddenInputs}
        {single ? (
          <div className="review__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={items[0].url} alt="Prévia da foto" />
          </div>
        ) : (
          <div className="review-grid" style={{ flex: 1 }}>
            {items.map((it) => (
              <figure key={it.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt="" />
                {!uploading ? (
                  <button
                    type="button"
                    aria-label="Remover esta foto"
                    onClick={() => {
                      URL.revokeObjectURL(it.url)
                      const next = items.filter((x) => x.id !== it.id)
                      setItems(next)
                      if (!next.length) setMode('home')
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </figure>
            ))}
          </div>
        )}
        <div className="review__panel">
          {uploading ? (
            <>
              <p className="review__question">
                {progress.total > 1 ? `Enviando ${progress.index} de ${progress.total}…` : 'Enviando…'}
              </p>
              <div className="progress" aria-hidden="true">
                <span style={{ width: `${progress.pct}%` }} />
              </div>
              <p className="field__hint">Mantenha esta tela aberta por um instante.</p>
            </>
          ) : (
            <>
              <p className="review__question">{single ? 'Gostou dessa foto?' : `${items.length} fotos selecionadas`}</p>
              <div className="field" style={{ textAlign: 'left', marginBottom: 10 }}>
                <label className="field__label" htmlFor="al-name">
                  Quer deixar seu nome? {props.requireName ? null : <span className="field__hint">(opcional)</span>}
                </label>
                <input id="al-name" className="input" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
              </div>
              {name.trim() ? (
                <label className="checkbox" style={{ marginBottom: 12, textAlign: 'left' }}>
                  <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
                  Pode mostrar meu nome junto à foto na galeria.
                </label>
              ) : null}
              {error ? (
                <p className="notice notice--error" role="alert" style={{ marginBottom: 12, textAlign: 'left' }}>
                  {error}
                </p>
              ) : null}
              <div className="btn-row btn-row--inline">
                <button type="button" className="btn" onClick={retake}>
                  {source === 'camera' ? 'Tirar novamente' : 'Escolher outras'}
                </button>
                <button type="button" className="btn btn--primary" onClick={() => void send()}>
                  {single ? 'Salvar no álbum' : `Salvar ${items.length} fotos`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'done') {
    return (
      <div className="result" role="status">
        {hiddenInputs}
        <p className="thanks-photo script">{result.sent > 1 ? `${result.sent} fotos recebidas! ❤️` : 'Foto recebida! ❤️'}</p>
        <p className="result__text">Obrigado por registrar esse momento conosco.</p>
        {props.requireApproval ? (
          <p className="field__hint" style={{ marginTop: 8 }}>
            Ela aparece na galeria assim que os noivos a aprovarem.
          </p>
        ) : null}
        {error ? (
          <p className="notice notice--error" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}
        <div className="btn-row" style={{ marginTop: 22 }}>
          {props.allowCamera ? (
            <button type="button" className="btn btn--primary" onClick={openCamera}>
              Tirar outra foto
            </button>
          ) : null}
          {props.allowGallery ? (
            <button type="button" className="btn" onClick={() => galleryInput.current?.click()}>
              Escolher da galeria
            </button>
          ) : null}
          {props.galleryHref ? (
            <Link className="btn btn--link" href={props.galleryHref}>
              Ver a galeria
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      {hiddenInputs}
      {error ? (
        <p className="notice notice--error" role="alert" style={{ marginBottom: 14, textAlign: 'left' }}>
          {error}
        </p>
      ) : null}
      <div className="btn-row">
        {props.allowCamera ? (
          <button type="button" className="btn btn--primary" onClick={openCamera}>
            Abrir câmera
          </button>
        ) : null}
        {props.allowGallery ? (
          <button type="button" className="btn" onClick={() => galleryInput.current?.click()}>
            Escolher da galeria
          </button>
        ) : null}
      </div>
    </div>
  )
}

function CameraView({
  onClose,
  onCapture,
  onUnavailable,
}: {
  onClose: () => void
  onCapture: (blob: Blob) => void
  onUnavailable: (message: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [canFlip, setCanFlip] = useState(false)
  const [ready, setReady] = useState(false)
  const [flash, setFlash] = useState(false)
  const [busy, setBusy] = useState(false)
  const unavailableRef = useRef(onUnavailable)
  useEffect(() => {
    unavailableRef.current = onUnavailable
  })

  useEffect(() => {
    let cancelled = false
    setReady(false)
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => {})
        }
        setReady(true)
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        setCanFlip(devices.filter((d) => d.kind === 'videoinput').length > 1)
      } catch (err) {
        const name = (err as DOMException)?.name
        unavailableRef.current(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Para usar a câmera aqui, permita o acesso quando o navegador perguntar. Enquanto isso, abrimos a câmera do seu celular.'
            : 'Não conseguimos abrir a câmera neste navegador. Abrimos a câmera do seu celular.',
        )
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [facing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shoot = async () => {
    const video = videoRef.current
    if (!video || !ready || busy || !video.videoWidth) return
    setBusy(true)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 400)
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    if (facing === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    try {
      const blob = await canvasToBlob(canvas, 0.92)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      onCapture(blob)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label="Câmera">
      <div className="camera__view">
        <div className="camera__top">
          <button type="button" className="camera__text-btn" onClick={onClose}>
            Fechar
          </button>
          {canFlip ? (
            <button type="button" className="camera__text-btn" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>
              Virar câmera
            </button>
          ) : null}
        </div>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="is-cover"
          style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined}
        />
        <div className={`camera__flash${flash ? ' is-on' : ''}`} />
        {!ready ? (
          <p style={{ position: 'absolute', color: 'var(--beige)', fontStyle: 'italic' }}>Abrindo a câmera…</p>
        ) : null}
      </div>
      <div className="camera__bar">
        <span style={{ width: 64 }} />
        <button type="button" className="shutter" aria-label="Tirar foto" onClick={() => void shoot()} disabled={!ready || busy}>
          <span />
        </button>
        <span style={{ width: 64 }} />
      </div>
    </div>
  )
}
