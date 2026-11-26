import { randomBytes, randomUUID } from "node:crypto"
import { unlinkSync } from "node:fs"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { readFile, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { listAlbumsForUser, openAlbum, parseAlbumInput, type Album } from "./albums.ts"
import { findDuplicatePhotos, resolveUploadFile } from "./duplicates.ts"
import { authenticateUser, type PublicUser, type User } from "./users.ts"
import {
  MAX_COLLAGE_BODY_BYTES,
  listCollagesForUser,
  parseCollageInput,
  photosBelongToAlbum,
  toPublicCollage,
  type StoredCollage,
} from "./collages.ts"
import {
  IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  detachFromAlbum,
  listPhotosForUser,
  titleFromFileName,
  toPublic,
  type StoredPhoto,
} from "./photos.ts"

export type PhotoStorage = {
  photos: StoredPhoto[]
  uploadsDir: string
  save: (photos: StoredPhoto[]) => void
}

export type CollageStorage = {
  collages: StoredCollage[]
  save: (collages: StoredCollage[]) => void
}

type Options = {
  albums: Album[]
  ownerId: string
  saveAlbums?: (albums: Album[]) => void
  users?: User[]
  photoStorage?: PhotoStorage
  collageStorage?: CollageStorage
}

const encoder = new TextEncoder()
const MAX_DUPLICATE_ACTION_BODY_BYTES = 64 * 1024
const DEPLOYED_FRONTEND_ORIGINS = new Set([
  "https://stsweng-smartalbum-1.onrender.com",
  "https://smartalbum-frontend-staging.onrender.com",
])

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
        return 
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

  await writeFile(join(storage.uploadsDir, file), body)
  // The album may have been deleted while its upload body/file was being written.
  if (!openAlbum(albums, ownerId, albumId)) {
    await unlink(join(storage.uploadsDir, file))
    send(res, 404, { error: "album not found" })
    return
  }
  const albumPhotos = storage.photos.filter((p) => p.ownerId === ownerId && p.albumId === albumId)
  stored.position = albumPhotos.reduce((max, p) => Math.max(max, p.position ?? 0), albumPhotos.length - 1) + 1
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

async function readJson(
  req: IncomingMessage,
  res: ServerResponse,
  limit = MAX_COLLAGE_BODY_BYTES,
): Promise<unknown | undefined> {
  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase()
  if (contentType !== "application/json") {
    req.resume()
    send(res, 415, { error: "expected application/json" })
    return undefined
  }
  const body = await readBody(req, limit)
  if (body === null) {
    send(res, 413, { error: "request too large" })
    return undefined
  }
  try {
    return JSON.parse(new TextDecoder().decode(body))
  } catch {
    send(res, 400, { error: "invalid JSON" })
    return undefined
  }
}

async function handleCollages(
  req: IncomingMessage,
  res: ServerResponse,
  albums: Album[],
  ownerId: string,
  id: string | undefined,
  storage: CollageStorage | undefined,
  photos: StoredPhoto[],
) {
  if (!storage) {
    req.resume()
    send(res, 501, { error: "collages are not configured" })
    return
  }
  const { collages } = storage

  if (id === undefined && req.method === "GET") {
    req.resume()
    const albumId = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("albumId") ?? undefined
    send(res, 200, listCollagesForUser(collages, ownerId, albumId))
    return
  }

  if (id === undefined && req.method === "POST") {
    const raw = await readJson(req, res)
    if (raw === undefined) return
    const parsed = parseCollageInput(raw)
    if ("error" in parsed) {
      send(res, 400, { error: parsed.error })
      return
    }
    const { input } = parsed
    if (!openAlbum(albums, ownerId, input.albumId)) {
      send(res, 404, { error: "album not found" })
      return
    }
    if (!photosBelongToAlbum(photos, ownerId, input.albumId, input.photoIds)) {
      send(res, 400, { error: "photoIds must be your photos in this album" })
      return
    }

    const now = new Date().toISOString()
    const stored: StoredCollage = { id: randomUUID(), ...input, ownerId, createdAt: now, updatedAt: now }
    collages.push(stored)
    try {
      storage.save(collages)
    } catch (err) {
      collages.pop()
      throw err
    }
    send(res, 201, toPublicCollage(stored))
    return
  }

  if (id !== undefined && req.method === "PUT") {
    const raw = await readJson(req, res)
    if (raw === undefined) return
    const index = collages.findIndex((c) => c.id === id && c.ownerId === ownerId)
    if (index === -1) {
      send(res, 404, { error: "collage not found" })
      return
    }
    const previous = collages[index]
    const parsed = parseCollageInput(raw)
    if ("error" in parsed) {
      send(res, 400, { error: parsed.error })
      return
    }
    const { input } = parsed
    if (input.albumId !== previous.albumId) {
      send(res, 400, { error: "a collage can't move to another album" })
      return
    }
    if (!photosBelongToAlbum(photos, ownerId, previous.albumId, input.photoIds)) {
      send(res, 400, { error: "photoIds must be your photos in this album" })
      return
    }

    const updated: StoredCollage = {
      ...previous,
      name: input.name,
      templateId: input.templateId,
      photoIds: input.photoIds,
      updatedAt: new Date().toISOString(),
    }
    collages[index] = updated
    try {
      storage.save(collages)
    } catch (err) {
      collages[index] = previous
      throw err
    }
    send(res, 200, toPublicCollage(updated))
    return
  }

  if (id !== undefined && req.method === "DELETE") {
    req.resume()
    const index = collages.findIndex((c) => c.id === id && c.ownerId === ownerId)
    if (index === -1) {
      send(res, 404, { error: "collage not found" })
      return
    }
    const [removed] = collages.splice(index, 1)
    try {
      storage.save(collages)
    } catch (err) {
      collages.splice(index, 0, removed)
      throw err
    }
    res.writeHead(204)
    res.end()
    return
  }

  req.resume()
  send(res, 405, { error: "method not allowed" })
}

function handleDetach(
  req: IncomingMessage,
  res: ServerResponse,
  albums: Album[],
  ownerId: string,
  albumId: string,
  photoId: string,
  storage: PhotoStorage | undefined,
) {
  req.resume()
  if (!storage) {
    send(res, 501, { error: "uploads are not configured" })
    return
  }
  if (!openAlbum(albums, ownerId, albumId)) {
    send(res, 404, { error: "album not found" })
    return
  }
  if (!detachFromAlbum(storage.photos, ownerId, albumId, photoId)) {
    send(res, 404, { error: "photo not found" })
    return
  }
  try {
    storage.save(storage.photos)
  } catch (err) {
    const photo = storage.photos.find((p) => p.id === photoId && p.ownerId === ownerId)
    if (photo) photo.albumId = albumId
    throw err
  }
  res.writeHead(204)
  res.end()
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
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  })
  res.end(bytes)
}

export function createAlbumServer({ albums, ownerId: demoOwnerId, saveAlbums, users, photoStorage, collageStorage }: Options): Server {
  // shortcut: sessions are process-local and capped; use a shared store before running multiple API instances.
  const sessions = new Map<string, { user: PublicUser; expires: number }>()
  const attempts = new Map<string, { count: number; expires: number }>()
  let loginWork = 0
  return createServer((req, res) => {
    const origin = req.headers.origin
    const allowedOrigin = origin === undefined || DEPLOYED_FRONTEND_ORIGINS.has(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    res.setHeader("Vary", "Origin")
    res.setHeader("Cache-Control", "no-store")
    if (origin && allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin)
      res.setHeader("Access-Control-Allow-Credentials", "true")
    }
    if (!allowedOrigin && req.method !== "GET") {
      req.resume(); send(res, 403, { error: "origin not allowed" }); return
    }

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    )
    
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-File-Name"
    )
    
    if(req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }
    
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    const fail = (err: unknown) => {
      console.error(err)
      if (!res.headersSent) send(res, 500, { error: "server error" })
    }

    const now = Date.now()
    for (const [token, session] of sessions) if (session.expires <= now) sessions.delete(token)
    for (const [ip, attempt] of attempts) if (attempt.expires <= now) attempts.delete(ip)
    const token = req.headers.cookie?.match(/(?:^|;\s*)smart-album-session=([a-f0-9]{64})(?:;|$)/)?.[1]
    const session = token ? sessions.get(token) : undefined
    const secure = req.headers["x-forwarded-proto"] === "https" || "encrypted" in req.socket
    const cookie = (value: string, age: number) => `smart-album-session=${value}; Path=/api; HttpOnly; Max-Age=${age}; ${secure ? "SameSite=None; Secure" : "SameSite=Lax"}`

    if (url.pathname === "/api/login" && req.method === "POST") {
      const handleLogin = async () => {
        const raw = await readJson(req, res)
        if (raw === undefined) return
        if (typeof raw !== "object" || raw === null) { send(res, 400, { error: "invalid credentials" }); return }
        const { username, password } = raw as Record<string, unknown>
        if (typeof username !== "string" || !username || username.length > 200 ||
          typeof password !== "string" || !password || password.length > 1024) {
          send(res, 400, { error: "invalid credentials" }); return
        }
        const ip = req.socket.remoteAddress ?? "unknown"
        const attempt = attempts.get(ip) ?? { count: 0, expires: Date.now() + 60_000 }
        if (attempt.count >= 20 || loginWork >= 4 || (attempts.size >= 1000 && !attempts.has(ip))) {
          res.setHeader("Retry-After", "60"); send(res, 429, { error: "too many login attempts; retry in one minute" }); return
        }
        attempt.count++
        attempts.set(ip, attempt)
        loginWork++
        let user: PublicUser | undefined
        try { user = await authenticateUser(users ?? [], username, password) } finally { loginWork-- }
        if (!user) { send(res, 401, { error: "invalid username or password" }); return }
        if (sessions.size >= 1000) { send(res, 503, { error: "session capacity reached" }); return }
        if (token) sessions.delete(token)
        const nextToken = randomBytes(32).toString("hex")
        sessions.set(nextToken, { user, expires: Date.now() + 8 * 60 * 60 * 1000 })
        res.setHeader("Set-Cookie", cookie(nextToken, 8 * 60 * 60))
        send(res, 200, user)
      }
      handleLogin().catch(fail)
      return
    }
    if (url.pathname === "/api/logout" && req.method === "POST") {
      req.resume()
      if (token) sessions.delete(token)
      res.setHeader("Set-Cookie", cookie("", 0))
      res.writeHead(204); res.end(); return
    }
    if (url.pathname === "/api/session" && req.method === "GET") {
      send(res, session ? 200 : 401, session?.user ?? { error: "sign in required" }); return
    }
    // Omitting users is only for existing injected-owner unit fixtures, never the runtime entry point.
    if (users !== undefined && !session) { req.resume(); send(res, 401, { error: "sign in required" }); return }
    const ownerId = session?.user.id ?? demoOwnerId
    if (session?.user.role !== "admin" && users !== undefined &&
      /^\/api\/albums(?:\/[^/]+)?$/.test(url.pathname) && ["POST", "PATCH"].includes(req.method ?? "")) {
      req.resume(); send(res, 403, { error: "only administrators create and label albums" }); return
    }

    const albumRoute = url.pathname.match(/^\/api\/albums(?:\/([^/]+))?$/)
    if (albumRoute && ["POST", "PATCH", "DELETE"].includes(req.method ?? "")) {
      const id = albumRoute[1] === undefined ? undefined : safeDecode(albumRoute[1])
      if (id === null) { req.resume(); send(res, 400, { error: "bad album id" }); return }
      if (!saveAlbums) { req.resume(); send(res, 501, { error: "album writes are not configured" }); return }
      const writeAlbum = async () => {
        if (id === undefined && req.method === "POST") {
          const raw = await readJson(req, res)
          if (raw === undefined) return
          const input = parseAlbumInput(raw)
          if (!input) { send(res, 400, { error: "title (1–200 characters) and description (up to 2000) are required" }); return }
          const created: Album = { id: randomUUID(), ...input, ownerId }
          albums.push(created)
          try { saveAlbums(albums) } catch (err) { albums.pop(); throw err }
          send(res, 201, created)
          return
        }
        if (id === undefined || req.method === "POST") { req.resume(); send(res, 405, { error: "method not allowed" }); return }
        if (req.method === "PATCH") {
          const raw = await readJson(req, res)
          if (raw === undefined) return
          const input = parseAlbumInput(raw)
          if (!input) { send(res, 400, { error: "invalid album title or description" }); return }
          const index = albums.findIndex((a) => a.id === id && a.ownerId === ownerId)
          if (index < 0) { send(res, 404, { error: "album not found" }); return }
          const previous = albums[index]
          albums[index] = { ...previous, ...input }
          try { saveAlbums(albums) } catch (err) { albums[index] = previous; throw err }
          send(res, 200, albums[index])
          return
        }
        req.resume()
        const index = albums.findIndex((a) => a.id === id && a.ownerId === ownerId)
        if (index < 0) { send(res, 404, { error: "album not found" }); return }
        const [removed] = albums.splice(index, 1)
        const oldPhotos = photoStorage?.photos.slice()
        const oldCollages = collageStorage?.collages.slice()
        if (photoStorage) {
          photoStorage.photos.splice(0, photoStorage.photos.length, ...photoStorage.photos.map((p) =>
            p.ownerId === ownerId && p.albumId === id ? { ...p, albumId: "" } : p))
        }
        if (collageStorage) {
          collageStorage.collages.splice(0, collageStorage.collages.length, ...collageStorage.collages.filter((c) =>
            c.ownerId !== ownerId || c.albumId !== id))
        }
        const persisted: (() => void)[] = []
        try {
          if (photoStorage && oldPhotos) {
            photoStorage.save(photoStorage.photos)
            persisted.push(() => photoStorage.save(oldPhotos))
          }
          if (collageStorage && oldCollages) {
            collageStorage.save(collageStorage.collages)
            persisted.push(() => collageStorage.save(oldCollages))
          }
          saveAlbums(albums)
        } catch (err) {
          albums.splice(index, 0, removed)
          if (photoStorage && oldPhotos) photoStorage.photos.splice(0, photoStorage.photos.length, ...oldPhotos)
          if (collageStorage && oldCollages) collageStorage.collages.splice(0, collageStorage.collages.length, ...oldCollages)
          for (const restore of persisted.reverse()) {
            try { restore() } catch (rollbackError) { console.error("Album deletion rollback failed", rollbackError) }
          }
          throw err
        }
        res.writeHead(204)
        res.end()
      }
      writeAlbum().catch(fail)
      return
    }

    const photoWrite = url.pathname.match(/^\/api\/albums\/([^/]+)\/photos(?:\/(order))?$/)
    if (photoWrite && req.method === "PATCH") {
      const id = safeDecode(photoWrite[1])
      const writePhotos = async () => {
        if (id === null) { req.resume(); send(res, 400, { error: "bad album id" }); return }
        if (!photoStorage) { req.resume(); send(res, 501, { error: "uploads are not configured" }); return }
        const raw = await readJson(req, res)
        if (raw === undefined) return
        if (!openAlbum(albums, ownerId, id)) { send(res, 404, { error: "album not found" }); return }
        const ids = typeof raw === "object" && raw !== null ? (raw as { photoIds?: unknown }).photoIds : undefined
        if (!Array.isArray(ids) || !ids.every((v) => typeof v === "string" && v !== "") || new Set(ids).size !== ids.length) {
          send(res, 400, { error: "photoIds must be a unique array of strings" }); return
        }
        const selected = ids.map((photoId) => photoStorage.photos.find((p) => p.ownerId === ownerId && p.id === photoId))
        if (selected.some((p) => !p)) { send(res, 404, { error: "photo not found" }); return }
        const previous = photoStorage.photos.slice()
        const inAlbum = photoStorage.photos.filter((p) => p.ownerId === ownerId && p.albumId === id)
        if (photoWrite[2]) {
          if (ids.length !== inAlbum.length || selected.some((p) => p!.albumId !== id)) {
            send(res, 400, { error: "order must contain every photo in this album exactly once" }); return
          }
          const positions = new Map(ids.map((photoId, position) => [photoId, position]))
          photoStorage.photos.splice(0, photoStorage.photos.length, ...photoStorage.photos.map((p) =>
            positions.has(p.id) && p.ownerId === ownerId ? { ...p, position: positions.get(p.id)! } : p))
        } else {
          const files = new Set(inAlbum.map((p) => p.file))
          let position = inAlbum.reduce((max, p) => Math.max(max, p.position ?? 0), inAlbum.length - 1) + 1
          for (const p of selected) {
            if (files.has(p!.file)) continue
            files.add(p!.file)
            // Memberships share immutable bytes; adding never moves a photo out of another album.
            photoStorage.photos.push({ ...p!, id: randomUUID(), albumId: id, position: position++ })
          }
        }
        try { photoStorage.save(photoStorage.photos) } catch (err) {
          photoStorage.photos.splice(0, photoStorage.photos.length, ...previous)
          throw err
        }
        send(res, 200, listPhotosForUser(photoStorage.photos, ownerId, id))
      }
      writePhotos().catch(fail)
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

    const detach = url.pathname.match(/^\/api\/albums\/([^/]+)\/photos\/([^/]+)$/)
    if (detach && req.method === "DELETE") {
      const albumId = safeDecode(detach[1])
      const photoId = safeDecode(detach[2])
      if (albumId === null || photoId === null) {
        send(res, 400, { error: "bad id" })
        return
      }
      try {
        handleDetach(req, res, albums, ownerId, albumId, photoId, photoStorage)
      } catch (err) {
        fail(err)
      }
      return
    }

    if (url.pathname === "/api/photos/duplicates" && req.method === "GET") {
      const albumId = url.searchParams.get("albumId") ?? undefined
      handleDuplicateGroups(req, res, albums, ownerId, albumId, photoStorage).catch(fail)
      return
    }

    if (url.pathname === "/api/photos/duplicates/delete" && req.method === "POST") {
      handleDuplicateRemoval(req, res, albums, ownerId, photoStorage).catch(fail)
      return
    }

    const duplicateRemoval = url.pathname.match(/^\/api\/photos\/duplicates\/([^/]+)$/)
    if (duplicateRemoval && req.method === "DELETE") {
      const photoId = safeDecode(duplicateRemoval[1])
      if (photoId === null) {
        req.resume()
        send(res, 400, { error: "bad photo id" })
        return
      }
      handleDuplicateRemoval(req, res, albums, ownerId, photoStorage, photoId).catch(fail)
      return
    }

    const collageRoute = url.pathname.match(/^\/api\/collages(?:\/([^/]+))?$/)
    if (collageRoute) {
      const collageId = collageRoute[1] === undefined ? undefined : safeDecode(collageRoute[1])
      if (collageId === null) {
        req.resume()
        send(res, 400, { error: "bad collage id" })
        return
      }
      handleCollages(req, res, albums, ownerId, collageId, collageStorage, photoStorage?.photos ?? []).catch(fail)
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

function parseDuplicateAction(value: unknown): { albumId?: string; photoIds: string[] } | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { error: "expected a JSON object" }
  const body = value as Record<string, unknown>
  if ("albumId" in body && (typeof body.albumId !== "string" || body.albumId === "")) {
    return { error: "albumId must be a non-empty string" }
  }
  const photoIds = body.photoIds
  if (!Array.isArray(photoIds) || photoIds.length === 0 || !photoIds.every((id) => typeof id === "string" && id !== "")) {
    return { error: "photoIds must be a non-empty list of non-empty strings" }
  }
  if (new Set(photoIds).size !== photoIds.length) return { error: "photoIds must not repeat" }
  return {
    ...(typeof body.albumId === "string" ? { albumId: body.albumId } : {}),
    photoIds: photoIds as string[],
  }
}

function replacePhotos(storage: PhotoStorage, next: StoredPhoto[]): void {
  const previous = [...storage.photos]
  storage.photos.splice(0, storage.photos.length, ...next)
  try {
    storage.save(storage.photos)
  } catch (err) {
    storage.photos.splice(0, storage.photos.length, ...previous)
    throw err
  }
}

function cleanupUnreferencedUploads(storage: PhotoStorage, removed: StoredPhoto[]): void {
  const remaining = storage.photos
  const referencedFiles = new Set(remaining.map((photo) => photo.file))
  const referencedPaths = new Set<string>()
  let referencesUnknown = false
  for (const photo of remaining) {
    try {
      referencedPaths.add(resolveUploadFile(storage.uploadsDir, photo.file).realPath)
    } catch {
      referencesUnknown = true
    }
  }
  if (referencesUnknown) console.error("Photo upload cleanup skipped; remaining photo paths could not be verified.")

  // shortcut: failed cleanup or unresolvable references can leave orphan bytes; add a locked retrying GC if repair or multi-process writers are needed.
  for (const file of new Set(removed.map((photo) => photo.file))) {
    if (referencedFiles.has(file) || referencesUnknown) continue
    try {
      const upload = resolveUploadFile(storage.uploadsDir, file)
      if (!referencedPaths.has(upload.realPath)) unlinkSync(upload.path)
    } catch {
      // The photo record is already gone; cleanup failure must not roll back committed metadata.
      console.error("Photo upload cleanup failed; removed photo metadata remains committed.")
    }
  }
}

function removeLibraryUploads(storage: PhotoStorage, ownerId: string, files: Set<string>): void {
  const removed = storage.photos.filter((photo) => photo.ownerId === ownerId && files.has(photo.file))
  replacePhotos(storage, storage.photos.filter((photo) => photo.ownerId !== ownerId || !files.has(photo.file)))
  cleanupUnreferencedUploads(storage, removed)
}

function detachAlbumUploads(storage: PhotoStorage, ownerId: string, albumId: string, files: Set<string>): void {
  replacePhotos(storage, storage.photos.map((photo) =>
    photo.ownerId === ownerId && photo.albumId === albumId && files.has(photo.file)
      ? { ...photo, albumId: "" }
      : photo,
  ))
}

async function handleDuplicateGroups(
  req: IncomingMessage,
  res: ServerResponse,
  albums: Album[],
  ownerId: string,
  albumId: string | undefined,
  storage: PhotoStorage | undefined,
) {
  req.resume()
  if (!storage) {
    send(res, 501, { error: "uploads are not configured" })
    return
  }
  if (albumId !== undefined && !openAlbum(albums, ownerId, albumId)) {
    send(res, 404, { error: "album not found" })
    return
  }
  const groups = await findDuplicatePhotos(storage.photos, ownerId, storage.uploadsDir, albumId)
  send(res, 200, groups)
}

async function handleDuplicateRemoval(
  req: IncomingMessage,
  res: ServerResponse,
  albums: Album[],
  ownerId: string,
  storage: PhotoStorage | undefined,
  photoId?: string,
) {
  if (!storage) {
    req.resume()
    send(res, 501, { error: "uploads are not configured" })
    return
  }
  let raw: unknown
  let photoIds: string[] = []
  if (photoId === undefined) {
    raw = await readJson(req, res, MAX_DUPLICATE_ACTION_BODY_BYTES)
    if (raw === undefined) return
  } else {
    req.resume()
  }

  let albumId: string | undefined
  if (photoId === undefined) {
    const parsed = parseDuplicateAction(raw)
    if ("error" in parsed) {
      send(res, 400, { error: parsed.error })
      return
    }
    albumId = parsed.albumId
    photoIds = parsed.photoIds
  } else {
    const queryAlbumId = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("albumId")
    albumId = queryAlbumId ?? undefined
  }
  if (albumId !== undefined && !openAlbum(albums, ownerId, albumId)) {
    send(res, 404, { error: "album not found" })
    return
  }

  const groups = await findDuplicatePhotos(storage.photos, ownerId, storage.uploadsDir, albumId)
  const extraIds = new Set(groups.flatMap((group) => group.duplicates.map((photo) => photo.id)))
  const scopedPhotos = storage.photos.filter((photo) => photo.ownerId === ownerId && (albumId === undefined || photo.albumId === albumId))
  const idCounts = new Map<string, number>()
  for (const photo of scopedPhotos) idCounts.set(photo.id, (idCounts.get(photo.id) ?? 0) + 1)
  const uniqueId = (id: string) => idCounts.get(id) === 1
  if (photoId !== undefined) {
    if (!extraIds.has(photoId)) {
      send(res, 409, { error: "photo is no longer a duplicate; scan again" })
      return
    }
    if (!uniqueId(photoId)) {
      send(res, 409, { error: "photo id is ambiguous; nothing was removed" })
      return
    }
    const selected = scopedPhotos.find((photo) => photo.id === photoId)
    if (!selected) {
      send(res, 404, { error: "photo not found" })
      return
    }
    const selectedFiles = new Set([selected.file])
    if (albumId !== undefined) {
      detachAlbumUploads(storage, ownerId, albumId, selectedFiles)
      res.writeHead(204)
      res.end()
      return
    }
    removeLibraryUploads(storage, ownerId, selectedFiles)
    res.writeHead(204)
    res.end()
    return
  }

  if (photoIds.some((id) => !extraIds.has(id))) {
    send(res, 409, { error: "one or more selected photos are no longer duplicate extras; scan again" })
    return
  }
  const removeIds = new Set(photoIds)
  if ([...removeIds].some((id) => !uniqueId(id))) {
    send(res, 409, { error: "duplicate photo ids are ambiguous; nothing was removed" })
    return
  }
  const selectedFiles = new Set(scopedPhotos.filter((photo) => removeIds.has(photo.id)).map((photo) => photo.file))
  if (removeIds.size > 0) {
    if (albumId === undefined) {
      removeLibraryUploads(storage, ownerId, selectedFiles)
    } else {
      detachAlbumUploads(storage, ownerId, albumId, selectedFiles)
    }
  }
  res.writeHead(204)
  res.end()
}
