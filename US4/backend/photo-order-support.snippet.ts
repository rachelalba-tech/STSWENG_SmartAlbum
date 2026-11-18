/* server/src/photos.ts — add to Photo type */
position?: number

/* server/src/photos.ts — listPhotosForUser should sort before mapping */
export function listPhotosForUser(photos: StoredPhoto[], ownerId: string, albumId?: string): Photo[] {
  return photos
    .filter((p) => p.ownerId === ownerId && (albumId === undefined || p.albumId === albumId))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(toPublic)
}

/* server/src/photo-store.ts — include in isStoredPhoto validation */
    typeof p.date === "string" &&
    typeof p.albumId === "string" &&
    Array.isArray(p.tags) &&
    (p.position === undefined || typeof p.position === "number") &&
    typeof p.ownerId === "string" &&
    typeof p.file === "string"
