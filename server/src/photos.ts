export type Photo = {
  id: string
  src: string
  thumbnail: string
  title: string
  description: string
  date: string
  albumId: string
  albumIds?: string[]
  tags: string[]
  position?: number
}

// What is kept on the server: the public photo plus who owns it and which file holds the bytes.
export type StoredPhoto = Photo & { ownerId: string; file: string }

// Only real raster formats. SVG is deliberately excluded because it can carry scripts.
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
}

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export function listPhotosForUser(photos: StoredPhoto[], ownerId: string, albumId?: string): Photo[] {
  const albumsByFile = new Map<string, string[]>()
  if (albumId === undefined) {
    for (const p of photos) {
      if (p.ownerId !== ownerId || !p.albumId) continue
      const list = albumsByFile.get(p.file) ?? []
      if (!list.includes(p.albumId)) list.push(p.albumId)
      albumsByFile.set(p.file, list)
    }
  }
  const files = new Set<string>()
  return photos
    .filter((p) => {
      if (p.ownerId !== ownerId || (albumId !== undefined && p.albumId !== albumId)) return false
      if (albumId === undefined && files.has(p.file)) return false
      files.add(p.file)
      return true
    })
    .sort((a, b) => albumId === undefined ? 0 : (a.position ?? 0) - (b.position ?? 0))
    .map((p) => albumId === undefined ? { ...toPublic(p), albumIds: albumsByFile.get(p.file) ?? [] } : toPublic(p))
}

// Drop the album link only. An empty albumId means the photo stays in the library.
export function detachFromAlbum(photos: StoredPhoto[], ownerId: string, albumId: string, photoId: string): boolean {
  const photo = photos.find((p) => p.id === photoId && p.ownerId === ownerId && p.albumId === albumId)
  if (!photo) return false
  photo.albumId = ""
  return true
}

export function toPublic({ ownerId: _ownerId, file: _file, ...photo }: StoredPhoto): Photo {
  return photo
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "").trim()
  return (base || "Photo").slice(0, 200)
}
