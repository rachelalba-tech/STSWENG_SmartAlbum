export type Album = {
  id: string
  title: string
  ownerId: string
  description?: string
}

export function parseAlbumInput(value: unknown): { title: string; description: string } | null {
  if (typeof value !== "object" || value === null) return null
  const input = value as Record<string, unknown>
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 200 ||
    (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 2000))) return null
  return { title: input.title.trim(), description: (input.description as string | undefined)?.trim() ?? "" }
}

export function listAlbumsForUser(albums: Album[], ownerId: string): Album[] {
  return albums.filter((album) => album.ownerId === ownerId)
}

export function openAlbum(albums: Album[], ownerId: string, id: string): Album | undefined {
  return albums.find((album) => album.id === id && album.ownerId === ownerId)
}
