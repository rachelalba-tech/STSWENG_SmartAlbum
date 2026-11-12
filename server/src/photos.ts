export type Photo = {
  id: string
  src: string
  thumbnail: string
  title: string
  description: string
  date: string
  albumId: string
  tags: string[]
}

export type StoredPhoto = Photo & { ownerId: string; file: string }

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
}

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export function listPhotosForUser(photos: StoredPhoto[], ownerId: string, albumId?: string): Photo[] {
  return photos
    .filter((p) => p.ownerId === ownerId && (albumId === undefined || p.albumId === albumId))
    .map(toPublic)
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