export type AlbumLike = {
  status: 'draft' | 'open' | 'closed'
  uploadsEnabled: boolean
  startsAt: Date | null
  endsAt: Date | null
}

export type AlbumUploadState = 'open' | 'not_started' | 'closed' | 'draft'

export function albumUploadState(album: AlbumLike, now = new Date()): AlbumUploadState {
  if (album.status === 'draft') return 'draft'
  if (album.status === 'closed' || !album.uploadsEnabled) return 'closed'
  if (album.endsAt && album.endsAt < now) return 'closed'
  if (album.startsAt && album.startsAt > now) return 'not_started'
  return 'open'
}
