export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")

export type User = { id: string; username: string; role: "admin" | "user" }

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, credentials: "include" })
  if (res.status === 401) window.dispatchEvent(new Event("session-expired"))
  return res
}

function parseUser(value: unknown): User | null {
  if (typeof value !== "object" || value === null) return null
  const user = value as Record<string, unknown>
  return typeof user.id === "string" && user.id !== "" && typeof user.username === "string" &&
    (user.role === "admin" || user.role === "user") ? { id: user.id, username: user.username, role: user.role } : null
}

export async function login(username: string, password: string): Promise<User> {
  const res = await apiFetch(`${API_URL}/api/login`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }),
  })
  if (res.status === 401) throw new Error("Incorrect username or password")
  if (res.status === 429) throw new Error("Too many sign-in attempts. Wait one minute and try again.")
  if (!res.ok) throw new Error("Could not sign in")
  const user = parseUser(await res.json())
  if (!user) throw new Error("Could not sign in: unexpected response")
  return user
}

export async function fetchSession(): Promise<User | null> {
  const res = await apiFetch(`${API_URL}/api/session`)
  if (res.status === 401) return null
  if (!res.ok) throw new Error("Could not check session")
  const user = parseUser(await res.json())
  if (!user) throw new Error("Could not check session")
  return user
}

export async function logout(): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/logout`, { method: "POST" })
  if (!res.ok) throw new Error("Could not log out. Try again.")
}

export type Album = {
  id: string
  title: string
  ownerId: string
  description?: string
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

//console.log("API URL:", import.meta.env.VITE_API_URL);

function isAlbum(value: unknown): value is Album {
  if (typeof value !== "object" || value === null) return false
  const album = value as Record<string, unknown>
  return (
    typeof album.id === "string" &&
    album.id !== "" &&
    typeof album.title === "string" &&
    typeof album.ownerId === "string" &&
    (album.description === undefined || typeof album.description === "string")
  )
}

// Required: id, src and albumId  
function parsePhoto(value: unknown): Photo | null {
  if (typeof value !== "object" || value === null) return null
  const p = value as Record<string, unknown>
  if (typeof p.id !== "string" || p.id === "") return null
  if (typeof p.src !== "string" || typeof p.albumId !== "string") return null
  return {
    id: p.id,
    src: photoUrl(p.src),
    thumbnail: photoUrl(typeof p.thumbnail === "string" ? p.thumbnail : p.src),
    title: typeof p.title === "string" ? p.title : "",
    description: typeof p.description === "string" ? p.description : "",
    date: typeof p.date === "string" ? p.date : "",
    albumId: p.albumId,
    tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === "string") : [],
  }
}

function photoUrl(value: string): string {
  return value.startsWith("/api/") ? API_URL + value : value
}

export async function fetchAlbums(): Promise<Album[]> {
  const res = await apiFetch(`${API_URL}/api/albums`)
  if (!res.ok) throw new Error("Could not load albums")
  const body: unknown = await res.json()
  if (!Array.isArray(body) || !body.every(isAlbum)) throw new Error("Could not load albums")
  return body
}

export async function fetchAlbum(id: string): Promise<Album> {
  const res = await apiFetch(`${API_URL}/api/albums/${encodeURIComponent(id)}`)
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
  const res = await apiFetch(`${API_URL}/api/photos${query}`)
  if (!res.ok) throw new Error("Could not load photos")
  const body: unknown = await res.json()
  if (!Array.isArray(body)) throw new Error("Could not load photos")
  const photos = body.map(parsePhoto)
  if (photos.some((p) => p === null)) throw new Error("Could not load photos")
  return photos as Photo[]
}

// POST /api/albums/:id/photos
// Errors for image type, photo size, and failed upload 
export async function uploadPhoto(albumId: string, file: File): Promise<Photo> {
  const res = await apiFetch(`${API_URL}/api/albums/${encodeURIComponent(albumId)}/photos`, {
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
  const res = await apiFetch(
    `${API_URL}/api/albums/${encodeURIComponent(albumId)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE" },
  )
  if (res.status === 404) throw new Error("That photo is not in this album")
  if (!res.ok) throw new Error("Could not remove photo")
}

export async function createAlbum(title: string, description = ""): Promise<Album> {
  return writeAlbum("", "POST", title, description)
}

export async function updateAlbum(id: string, title: string, description: string): Promise<Album> {
  return writeAlbum(`/${encodeURIComponent(id)}`, "PATCH", title, description)
}

async function writeAlbum(path: string, method: string, title: string, description: string): Promise<Album> {
  const res = await apiFetch(`${API_URL}/api/albums${path}`, {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify({ title, description }),
  })
  if (!res.ok) throw new Error(`Could not save album (${res.status})`)
  const album: unknown = await res.json()
  if (!isAlbum(album)) throw new Error("Could not save album: unexpected response")
  return album
}

export async function deleteAlbum(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/albums/${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!res.ok) throw new Error(`Could not delete album (${res.status})`)
}

export async function addPhotosToAlbum(id: string, photoIds: string[]): Promise<Photo[]> {
  return writePhotos(id, "", photoIds)
}

export async function reorderAlbumPhotos(id: string, photoIds: string[]): Promise<Photo[]> {
  return writePhotos(id, "/order", photoIds)
}

async function writePhotos(id: string, path: string, photoIds: string[]): Promise<Photo[]> {
  const res = await apiFetch(`${API_URL}/api/albums/${encodeURIComponent(id)}/photos${path}`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ photoIds }),
  })
  if (!res.ok) throw new Error(`Could not save album photos (${res.status})`)
  const body: unknown = await res.json()
  if (!Array.isArray(body)) throw new Error("Unexpected photo response")
  const photos = body.map(parsePhoto)
  if (photos.some((p) => !p)) throw new Error("Unexpected photo response")
  return photos as Photo[]
}
