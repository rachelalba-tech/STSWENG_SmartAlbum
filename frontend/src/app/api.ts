export type Album = {
  id: string
  title: string
  ownerId: string
}

function isAlbum(value: unknown): value is Album {
  if (typeof value !== "object" || value === null) return false
  const album = value as Record<string, unknown>
  return (
    typeof album.id === "string" &&
    album.id !== "" &&
    typeof album.title === "string" &&
    typeof album.ownerId === "string"
  )
}

export async function fetchAlbums(): Promise<Album[]> {
  const res = await fetch("/api/albums")
  if (!res.ok) throw new Error("Could not load albums")
  const body: unknown = await res.json()
  if (!Array.isArray(body) || !body.every(isAlbum)) throw new Error("Could not load albums")
  return body
}

export async function fetchAlbum(id: string): Promise<Album> {
  const res = await fetch(`/api/albums/${encodeURIComponent(id)}`)
  if (res.status === 404) throw new Error("Album not found")
  if (!res.ok) throw new Error("Could not open album")
  const body: unknown = await res.json()
  if (!isAlbum(body)) throw new Error("Could not open album")
  return body
}
