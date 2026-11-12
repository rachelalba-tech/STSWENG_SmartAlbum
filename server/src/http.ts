import { randomUUID } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { readFile, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { listAlbumsForUser, openAlbum, type Album } from "./albums.ts"
import {
  IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  listPhotosForUser,
  titleFromFileName,
  toPublic,
  type StoredPhoto,
} from "./photos.ts"
import { authenticateUser, type User } from "./users.ts"

export type PhotoStorage = {
  /** Live list of stored photos; new uploads are pushed onto it. */
  photos: StoredPhoto[]
  /** Folder that holds the image files. */
  uploadsDir: string
  /** Persists the list. Must be synchronous so concurrent uploads can't interleave writes. */
  save: (photos: StoredPhoto[]) => void
}

type Options = {
  albums: Album[]
  ownerId: string
  users?: User[]
  /** Leave out to run without photo support (uploads then answer 501). */
  photoStorage?: PhotoStorage
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const MAX_LOGIN_BYTES = 8 * 1024

function send(res: ServerResponse, status: number, body: unknown) {
  const bytes = encoder.encode(JSON.stringify(body))
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": bytes.length,
  })
  res.end(bytes)
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

// Resolves with the body, or null if it grew past the limit.
function readBody(req: IncomingMessage, limit: number): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let size = 0
    let done = false
    req.on("data", (chunk: Uint8Array) => {
      if (done) return
      size += chunk.length
      if (size > limit) {
        done = true
        resolve(null)
        return // keep draining so the client can read our 413
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      if (done) return
      const all = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        all.set(chunk, offset)
        offset += chunk.length
      }
      resolve(all)
    })
    req.on("error", reject)
  })
}

async function handleUpload(
  req: IncomingMessage,
  res: ServerResponse,
  albums: Album[],
  ownerId: string,
  albumId: string,
  storage: PhotoStorage | undefined,
) {
  if (!storage) {
    send(res, 501, { error: "uploads are not configured" })
    return
  }
  if (!openAlbum(albums, ownerId, albumId)) {
    req.resume()
    send(res, 404, { error: "album not found" })
    return
  }

  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase()
  const ext = IMAGE_TYPES[contentType]
  if (!ext) {
    req.resume()
    send(res, 415, { error: "unsupported image type" })
    return
  }
  const declared = Number(req.headers["content-length"])
  if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES) {
    req.resume()
    send(res, 413, { error: "photo too large" })
    return
  }

  const body = await readBody(req, MAX_PHOTO_BYTES)
  if (body === null) {
    send(res, 413, { error: "photo too large" })
    return
  }
  if (body.length === 0) {
    send(res, 400, { error: "empty upload" })
    return
  }

  const rawName = req.headers["x-file-name"]
  const fileName = safeDecode(typeof rawName === "string" ? rawName : "") ?? ""

  const id = randomUUID()
  const file = `${id}${ext}`
  const url = `/api/uploads/${file}`
  const stored: StoredPhoto = {
    id,
    src: url,
    thumbnail: url,
    title: titleFromFileName(fileName),
    description: "",
    date: new Date().toISOString().slice(0, 10),
    albumId,
    tags: [],
    ownerId,
    file,
  }

  // Bytes first, then the record. If recording fails, remove the file and report an error,
  // so the client keeps the photo for a retry instead of believing it was saved.
  await writeFile(join(storage.uploadsDir, file), body)
  try {
    storage.photos.push(stored)
    storage.save(storage.photos)
  } catch (err) {
    storage.photos.pop()
    await unlink(join(storage.uploadsDir, file)).catch(() => {})
    throw err
  }
  send(res, 201, toPublic(stored))
}

async function handleLogin(req: IncomingMessage, res: ServerResponse, users: User[]) {
  const body = await readBody(req, MAX_LOGIN_BYTES)
  if (body === null) {
    send(res, 413, { error: "login request too large" })
    return
  }

  let credentials: unknown
  try {
    credentials = JSON.parse(decoder.decode(body))
  } catch {
    send(res, 400, { error: "invalid login request" })
    return
  }

  if (typeof credentials !== "object" || credentials === null) {
    send(res, 400, { error: "invalid login request" })
    return
  }

  const values = credentials as Record<string, unknown>
  if (typeof values.username !== "string" || typeof values.password !== "string") {
    send(res, 400, { error: "invalid login request" })
    return
  }

  const user = authenticateUser(users, values.username, values.password)
  send(res, user ? 200 : 401, user ?? { error: "invalid username or password" })
}

async function handleImage(res: ServerResponse, ownerId: string, file: string, storage: PhotoStorage | undefined) {
  const photo = storage?.photos.find((p) => p.file === file && p.ownerId === ownerId)
  if (!storage || !photo) {
    send(res, 404, { error: "photo not found" })
    return
  }
  const type = Object.entries(IMAGE_TYPES).find(([, e]) => file.endsWith(e))?.[0] ?? "application/octet-stream"
  const bytes = await readFile(join(storage.uploadsDir, photo.file))
  res.writeHead(200, {
    "content-type": type,
    "content-length": bytes.length,
    "cache-control": "private, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  })
  res.end(bytes)
}

export function createAlbumServer({ albums, ownerId, users = [], photoStorage }: Options): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    const fail = (err: unknown) => {
      console.error(err)
      if (!res.headersSent) send(res, 500, { error: "server error" })
    }

    if (url.pathname === "/api/login" && req.method === "POST") {
      handleLogin(req, res, users).catch(fail)
      return
    }

    const upload = url.pathname.match(/^\/api\/albums\/([^/]+)\/photos$/)
    if (upload && req.method === "POST") {
      const albumId = safeDecode(upload[1])
      if (albumId === null) {
        send(res, 400, { error: "bad album id" })
        return
      }
      handleUpload(req, res, albums, ownerId, albumId, photoStorage).catch(fail)
      return
    }

    if (req.method !== "GET") {
      send(res, 405, { error: "method not allowed" })
      return
    }
    if (url.pathname === "/api/albums") {
      send(res, 200, listAlbumsForUser(albums, ownerId))
      return
    }
    if (url.pathname === "/api/photos") {
      const albumId = url.searchParams.get("albumId") ?? undefined
      send(res, 200, listPhotosForUser(photoStorage?.photos ?? [], ownerId, albumId))
      return
    }
    const image = url.pathname.match(/^\/api\/uploads\/([A-Za-z0-9-]+\.[a-z0-9]+)$/)
    if (image) {
      handleImage(res, ownerId, image[1], photoStorage).catch(fail)
      return
    }
    const match = url.pathname.match(/^\/api\/albums\/([^/]+)$/)
    if (match) {
      const id = safeDecode(match[1])
      const album = id === null ? undefined : openAlbum(albums, ownerId, id)
      send(res, album ? 200 : 404, album ?? { error: "album not found" })
      return
    }
    send(res, 404, { error: "not found" })
  })
}
