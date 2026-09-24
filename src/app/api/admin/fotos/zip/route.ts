import { Zip, ZipPassThrough } from 'fflate'
import { desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { getAdmin } from '@/lib/auth/session'
import { storage } from '@/lib/storage'
import { photoDownloadName } from '@/lib/album'
import { audit } from '@/lib/audit'

/** ZIP em streaming dos ORIGINAIS (sem recompressão — fotos já são comprimidas). */
export async function GET(req: Request) {
  const admin = await getAdmin()
  if (!admin) return new Response('Não autorizado', { status: 401 })
  const sp = new URL(req.url).searchParams
  const ids = (sp.get('ids') ?? '').split(',').filter((id) => /^[0-9a-f-]{36}$/.test(id))
  const status = sp.get('status')
  const photos = ids.length
    ? await db.select().from(schema.photos).where(inArray(schema.photos.id, ids.slice(0, 2000)))
    : status === 'todas'
      ? await db.select().from(schema.photos).orderBy(desc(schema.photos.createdAt))
      : await db.select().from(schema.photos).where(eq(schema.photos.status, 'approved')).orderBy(desc(schema.photos.createdAt))
  if (!photos.length) return new Response('Nenhuma foto para baixar.', { status: 404 })
  await audit(admin.id, 'photo.download_zip', 'photo', null, { count: photos.length })

  const zip = new Zip()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      zip.ondata = (err, chunk, final) => {
        if (err) return controller.error(err)
        controller.enqueue(chunk)
        if (final) controller.close()
      }
      void (async () => {
        const used = new Set<string>()
        for (const p of photos) {
          let name = photoDownloadName(p)
          if (p.status !== 'approved') name = `${p.status}/${name}`
          while (used.has(name)) name = name.replace(/(\.\w+)$/, '-1$1')
          used.add(name)
          const obj = await storage().getStream(p.originalKey)
          if (!obj) continue
          const entry = new ZipPassThrough(name)
          entry.mtime = p.createdAt
          zip.add(entry)
          const reader = obj.body.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            entry.push(value)
          }
          entry.push(new Uint8Array(0), true)
        }
        zip.end()
      })().catch((err) => controller.error(err))
    },
  })
  const day = new Date().toISOString().slice(0, 10)
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="album-noivado-${day}.zip"`,
      'Cache-Control': 'no-store',
    },
  })
}
