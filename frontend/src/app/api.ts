const API_URL = import.meta.env.VITE_API_URL.replace(/\/+$/, "");

export type Album = {
  id: string
  title: string
  ownerId: string
}

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

export type DuplicateGroup = { keeper: Photo; duplicates: Photo[] }

//console.log("API URL:", import.meta.env.VITE_API_URL);

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

// Required: id, src and albumId  
function resolvePhotoUrl(url: string): string {
  return url.startsWith("/api/uploads/") ? `${API_URL}${url}` : url
}

function parsePhoto(value: unknown): Photo | null {
  if (typeof value !== "object" || value === null) return null
  const p = value as Record<string, unknown>
  if (typeof p.id !== "string" || p.id === "") return null
  if (typeof p.src !== "string" || typeof p.albumId !== "string") return null
  const src = resolvePhotoUrl(p.src)
  return {
    id: p.id,
    src,
    thumbnail: typeof p.thumbnail === "string" ? resolvePhotoUrl(p.thumbnail) : src,
    title: typeof p.title === "string" ? p.title : "",
    description: typeof p.description === "string" ? p.description : "",
    date: typeof p.date === "string" ? p.date : "",
    albumId: p.albumId,
    tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === "string") : [],
  }
}

export async function fetchAlbums(): Promise<Album[]> {
  const res = await fetch(`${API_URL}/api/albums`)
  if (!res.ok) throw new Error("Could not load albums")
  const body: unknown = await res.json()
  if (!Array.isArray(body) || !body.every(isAlbum)) throw new Error("Could not load albums")
  return body
}

export async function fetchAlbum(id: string): Promise<Album> {
  const res = await fetch(`${API_URL}/api/albums/${encodeURIComponent(id)}`)
  if (res.status === 404) throw new Error("Album not found")
  if (!res.ok) throw new Error("Could not open album")
  const body: unknown = await res.json()
  if (!isAlbum(body)) throw new Error("Could not open album")
  return body
}

// GET /api/photos            -> every photo of the user
// GET /api/photos?albumId=ID -> photos of one album
export async function fetchPhotos(albumId?: string): Promise<Photo[]> {
  const query = albumId ? `?albumId=${encodeURIComponent(albumId)}` : ""
  const res = await fetch(`${API_URL}/api/photos${query}`)
  if (!res.ok) throw new Error("Could not load photos")
  const body: unknown = await res.json()
  if (!Array.isArray(body)) throw new Error("Could not load photos")
  const photos = body.map(parsePhoto)
  if (photos.some((p) => p === null)) throw new Error("Could not load photos")
  return photos as Photo[]
}

function parseDuplicateGroup(value: unknown): DuplicateGroup | null {
  if (typeof value !== "object" || value === null) return null
  const group = value as Record<string, unknown>
  const keeper = parsePhoto(group.keeper)
  if (!keeper || !Array.isArray(group.duplicates) || group.duplicates.length === 0) return null
  const duplicates = group.duplicates.map(parsePhoto)
  if (duplicates.some((photo) => photo === null)) return null
  return { keeper, duplicates: duplicates as Photo[] }
}

async function duplicateError(res: Response): Promise<Error> {
  let message = "Could not update duplicates"
  try {
    const body: unknown = await res.json()
    if (typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string") {
      message = (body as { error: string }).error
    }
  } catch {
    // Some server errors have no JSON body.
  }
  return new Error(message)
}

export async function fetchDuplicateGroups(albumId?: string): Promise<DuplicateGroup[]> {
  const query = albumId ? `?albumId=${encodeURIComponent(albumId)}` : ""
  const res = await fetch(`${API_URL}/api/photos/duplicates${query}`)
  if (!res.ok) throw await duplicateError(res)
  const body: unknown = await res.json()
  if (!Array.isArray(body)) throw new Error("Unexpected duplicate response")
  const groups = body.map(parseDuplicateGroup)
  if (groups.some((group) => group === null)) throw new Error("Unexpected duplicate response")
  return groups as DuplicateGroup[]
}

export async function removeDuplicatePhoto(photoId: string, albumId?: string): Promise<void> {
  const query = albumId ? `?albumId=${encodeURIComponent(albumId)}` : ""
  const res = await fetch(`${API_URL}/api/photos/duplicates/${encodeURIComponent(photoId)}${query}`, { method: "DELETE" })
  if (!res.ok) throw await duplicateError(res)
}

export async function removeDuplicatePhotos(albumId: string | undefined, photoIds: string[]): Promise<void> {
  const res = await fetch(`${API_URL}/api/photos/duplicates/delete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...(albumId ? { albumId } : {}), photoIds }),
  })
  if (!res.ok) throw await duplicateError(res)
}

// POST /api/albums/:id/photos
// Errors for image type, photo size, and failed upload 
export async function uploadPhoto(albumId: string, file: File): Promise<Photo> {
  const res = await fetch(`${API_URL}/api/albums/${encodeURIComponent(albumId)}/photos`, {
    method: "POST",
    headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) },
    body: file,
  })
  if (res.status === 415) throw new Error("This image type is not supported")
  if (res.status === 413) throw new Error("This photo is too large")
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const created = parsePhoto(await res.json())
  if (!created) throw new Error("Upload failed: unexpected server response")
  return created
}

// DELETE /api/albums/:albumId/photos/:photoId
// The file stays in the library. Only the album link is cleared.
export async function removePhotoFromAlbum(albumId: string, photoId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/albums/${encodeURIComponent(albumId)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE" },
  )
  if (res.status === 404) throw new Error("That photo is not in this album")
  if (!res.ok) throw new Error("Could not remove photo")
}
