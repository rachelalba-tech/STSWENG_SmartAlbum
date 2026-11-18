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
