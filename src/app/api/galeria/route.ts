import { listApprovedPhotos } from '@/lib/album'
import { getMainAlbum } from '@/lib/content'

export async function GET(req: Request) {
  const album = await getMainAlbum()
  if (!album || !album.publicGalleryEnabled) return Response.json({ photos: [], nextCursor: null })
  const cursor = new URL(req.url).searchParams.get('cursor')
  const page = await listApprovedPhotos(album.id, cursor, 30)
  return Response.json(page, { headers: { 'Cache-Control': 'public, max-age=30' } })
}
