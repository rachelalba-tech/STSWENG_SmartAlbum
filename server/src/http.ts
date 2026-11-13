import { randomUUID } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { readFile, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { listAlbumsForUser, openAlbum, type Album } from "./albums.ts"
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
  photoStorage?: PhotoStorage
  collageStorage?: CollageStorage
}

const encoder = new TextEncoder()

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

async function readJson(req: IncomingMessage, res: ServerResponse): Promise<unknown | undefined> {
  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase()
  if (contentType !== "application/json") {
    req.resume()
    send(res, 415, { error: "expected application/json" })
    return undefined
  }
  const body = await readBody(req, MAX_COLLAGE_BODY_BYTES)
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
    "cache-control": "private, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  })
  res.end(bytes)
}

export function createAlbumServer({ albums, ownerId, photoStorage, collageStorage }: Options): Server {
  return createServer((req, res) => {
    res.setHeader(
      "Access-Control-Allow-Origin",
      "https://stsweng-smartalbum-1.onrender.com" 
    )

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
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