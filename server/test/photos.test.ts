import assert from "node:assert/strict"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import type { Album } from "../src/albums.ts"
import { createAlbumServer } from "../src/http.ts"
import { savePhotos } from "../src/photo-store.ts"
import type { StoredPhoto } from "../src/photos.ts"

const albums: Album[] = [
  { id: "opening", title: "Opening ceremony", ownerId: "demo-user" },
  { id: "secret", title: "Not yours", ownerId: "other-user" },
]

function photo(id: string, albumId: string, ownerId = "demo-user"): StoredPhoto {
  return {
    id,
    src: `/api/uploads/${id}.jpg`,
    thumbnail: `/api/uploads/${id}.jpg`,
    title: id,
    description: "",
    date: "2026-10-31",
    albumId,
    tags: [],
    ownerId,
    file: `${id}.jpg`,
  }
}

async function startServer(
  photos: StoredPhoto[],
  albumsToUse: Album[] = albums,
  save: (file: string, all: StoredPhoto[]) => void = savePhotos,
) {
  const dir = mkdtempSync(path.join(tmpdir(), "photos-add-"))
  const uploadsDir = path.join(dir, "uploads")
  mkdirSync(uploadsDir)
  const photosFile = path.join(dir, "photos.json")
  for (const item of photos) {
    const file = path.join(uploadsDir, item.file)
    if (!existsSync(file)) writeFileSync(file, "image bytes")
  }
  const storage = { photos, uploadsDir, save: (all: StoredPhoto[]) => save(photosFile, all) }
  const server = createAlbumServer({ albums: albumsToUse, ownerId: "demo-user", photoStorage: storage })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("test server did not bind a port")
  return {
    base: `http://127.0.0.1:${address.port}`,
    dir,
    photosFile,
    server,
    storage,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  }
}

test("removing a photo drops it from the album and leaves it in the library", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "photos-"))
  const uploadsDir = path.join(dir, "uploads")
  mkdirSync(uploadsDir)
  const photosFile = path.join(dir, "photos.json")
  const photos = [photo("keep", "opening"), photo("gone", "opening"), photo("other", "opening", "other-user")]
  for (const item of photos) writeFileSync(path.join(uploadsDir, item.file), "bytes")
  const storage = { photos, uploadsDir, save: (all: StoredPhoto[]) => savePhotos(photosFile, all) }
  const server = createAlbumServer({ albums, ownerId: "demo-user", photoStorage: storage })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("test server did not bind a port")
  const base = `http://127.0.0.1:${address.port}`

  try {
    const removed = await fetch(`${base}/api/albums/opening/photos/gone`, { method: "DELETE" })
    assert.equal(removed.status, 204)

    const inAlbum = await fetch(`${base}/api/photos?albumId=opening`)
    const albumIds = (await inAlbum.json()).map((p: { id: string }) => p.id)
    assert.deepEqual(albumIds, ["keep"])

    const library = await fetch(`${base}/api/photos`)
    const libraryIds = (await library.json()).map((p: { id: string }) => p.id)
    assert.deepEqual(libraryIds, ["keep", "gone"])

    const file = await fetch(`${base}/api/uploads/gone.jpg`)
    assert.equal(file.status, 200)
    assert.equal(existsSync(path.join(uploadsDir, "gone.jpg")), true)
    assert.equal(JSON.parse(readFileSync(photosFile, "utf8"))[1].albumId, "")

    const again = await fetch(`${base}/api/albums/opening/photos/gone`, { method: "DELETE" })
    assert.equal(again.status, 404)
    const hidden = await fetch(`${base}/api/albums/opening/photos/other`, { method: "DELETE" })
    assert.equal(hidden.status, 404)
    const missingAlbum = await fetch(`${base}/api/albums/secret/photos/keep`, { method: "DELETE" })
    assert.equal(missingAlbum.status, 404)
    assert.equal(photos.find((p) => p.id === "keep")?.albumId, "opening")
    assert.equal(photos.find((p) => p.id === "other")?.albumId, "opening")
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    rmSync(dir, { recursive: true, force: true })
  }
})

test("PATCH adds owned photos to another album, preserves the source, persists, and deduplicates by file", async () => {
  const targetAlbum: Album = { id: "target", title: "Target album", ownerId: "demo-user" }
  const source = photo("source", "opening")
  const sameFile = photo("same-file", "opening")
  sameFile.file = source.file
  const photos = [source, sameFile, photo("private", "opening", "other-user")]
  const app = await startServer(photos, [...albums, targetAlbum])

  try {
    const options = await fetch(`${app.base}/api/albums/target/photos`, { method: "OPTIONS" })
    assert.equal(options.status, 204)
    assert.match(options.headers.get("access-control-allow-methods") ?? "", /PATCH/)
    assert.match(options.headers.get("access-control-allow-headers") ?? "", /Content-Type/i)

    const add = (photoIds: unknown[], albumId = "target") => fetch(`${app.base}/api/albums/${albumId}/photos`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoIds }),
    })
    const response = await add(["source", "same-file"])
    assert.equal(response.status, 200)
    const targetPhotos = await response.json()
    assert.equal(targetPhotos.length, 1)
    assert.equal(targetPhotos[0].albumId, "target")
    assert.notEqual(targetPhotos[0].id, "source")
    assert.equal(source.albumId, "opening")
    assert.equal(sameFile.albumId, "opening")

    const sourcePhotos = await fetch(`${app.base}/api/photos?albumId=opening`)
    assert.deepEqual((await sourcePhotos.json()).map((item: { id: string }) => item.id), ["source", "same-file"])
    const library = await fetch(`${app.base}/api/photos`)
    assert.deepEqual((await library.json()).map((item: { id: string }) => item.id), ["source"])

    const repeated = await add(["source"])
    const repeatedPhotos = await repeated.json()
    assert.equal(repeatedPhotos.length, 1)
    assert.equal(repeatedPhotos[0].id, targetPhotos[0].id)
    const persisted = JSON.parse(readFileSync(app.photosFile, "utf8")) as StoredPhoto[]
    assert.equal(persisted.length, 4)
    assert.equal(persisted[3].file, source.file)
    assert.equal(persisted[3].albumId, "target")
  } finally {
    await app.close()
    rmSync(app.dir, { recursive: true, force: true })
  }
})

test("PATCH validates input and hides photos or albums not owned by the request user", async () => {
  const app = await startServer([photo("source", "opening"), photo("private", "opening", "other-user")])
  const add = (photoIds: unknown[], albumId = "opening") => fetch(`${app.base}/api/albums/${albumId}/photos`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ photoIds }),
  })

  try {
    assert.equal((await add(["source", "source"])).status, 400)
    assert.equal((await add(["source", 1])).status, 400)
    assert.equal((await add([""])).status, 400)
    assert.equal((await add(["missing"])).status, 404)
    assert.equal((await add(["private"])).status, 404)
    assert.equal((await add(["source"], "secret")).status, 404)

    const wrongType = await fetch(`${app.base}/api/albums/opening/photos`, {
      method: "PATCH",
      headers: { "content-type": "text/plain" },
      body: "{}",
    })
    assert.equal(wrongType.status, 415)
    const invalidJson = await fetch(`${app.base}/api/albums/opening/photos`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{",
    })
    assert.equal(invalidJson.status, 400)
    assert.equal(app.storage.photos.length, 2)
  } finally {
    await app.close()
    rmSync(app.dir, { recursive: true, force: true })
  }
})

test("PATCH rolls back in-memory photo memberships when persistence fails", async () => {
  const targetAlbum: Album = { id: "target", title: "Target album", ownerId: "demo-user" }
  const app = await startServer([photo("source", "opening")], [...albums, targetAlbum], () => {
    throw new Error("simulated persistence failure")
  })
  const originalError = console.error
  console.error = () => {}

  try {
    const saveFailure = await fetch(`${app.base}/api/albums/target/photos`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoIds: ["source"] }),
    })
    assert.equal(saveFailure.status, 500)
    assert.equal(app.storage.photos.length, 1)
    assert.equal(app.storage.photos[0].albumId, "opening")
    assert.equal(existsSync(app.photosFile), false)
  } finally {
    console.error = originalError
    await app.close()
    rmSync(app.dir, { recursive: true, force: true })
  }
})
