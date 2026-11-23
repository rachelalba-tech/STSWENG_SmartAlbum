import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createAlbumServer } from "../src/http.ts"
import { loadAlbums, saveAlbums } from "../src/store.ts"
import { loadPhotos, savePhotos } from "../src/photo-store.ts"
import { loadCollages, saveCollages } from "../src/collage-store.ts"
import type { StoredCollage } from "../src/collages.ts"
import type { Album } from "../src/albums.ts"
import type { StoredPhoto } from "../src/photos.ts"

async function fixture(run: (f: {
  base: string; albums: Album[]; photos: StoredPhoto[]; file: string; photosFile: string; uploads: string
  collages: StoredCollage[]; collagesFile: string; fail: (value: boolean) => void
}) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "album-writes-"))
  const uploads = join(dir, "uploads")
  mkdirSync(uploads)
  const file = join(dir, "albums.json")
  const photosFile = join(dir, "photos.json")
  const collagesFile = join(dir, "collages.json")
  const collages: StoredCollage[] = [{ id: "c", albumId: "a", name: "Saved", templateId: "grid", photoIds: ["one"], ownerId: "demo-user", createdAt: "now", updatedAt: "now" }]
  const albums: Album[] = [{ id: "a", title: "A", ownerId: "demo-user" }, { id: "foreign", title: "Private", ownerId: "other" }]
  const photos: StoredPhoto[] = ["one", "two", "private"].map((id) => ({
    id, src: `/api/uploads/${id}.png`, thumbnail: `/api/uploads/${id}.png`, file: `${id}.png`, title: id,
    description: "", date: "2026-11-19", albumId: "a", ownerId: id === "private" ? "other" : "demo-user", tags: [],
  }))
  for (const p of photos) writeFileSync(join(uploads, p.file), "image bytes")
  saveAlbums(file, albums)
  savePhotos(photosFile, photos)
  saveCollages(collagesFile, collages)
  let failWrites = false
  const server = createAlbumServer({
    albums, ownerId: "demo-user", saveAlbums: (all) => {
      if (failWrites) throw new Error("simulated disk failure")
      saveAlbums(file, all)
    }, photoStorage: { photos, uploadsDir: uploads, save: (all) => savePhotos(photosFile, all) },
    collageStorage: { collages, save: (all) => saveCollages(collagesFile, all) },
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("no test port")
  try { await run({ base: `http://127.0.0.1:${address.port}`, albums, photos, file, photosFile, uploads, collages, collagesFile, fail: (v) => { failWrites = v } }) }
  finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    rmSync(dir, { recursive: true, force: true })
  }
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

test("album create, details, photo membership/order and deletion persist without losing library bytes", async () => {
  await fixture(async ({ base, file, photosFile, uploads, photos, collagesFile }) => {
    const created = await fetch(`${base}/api/albums`, json("POST", { title: "  New event  ", description: "  Opening  " }))
    assert.equal(created.status, 201)
    const album = await created.json()
    assert.equal(album.title, "New event")
    assert.equal(album.description, "Opening")
    assert.equal(loadAlbums(file).find((a) => a.id === album.id)?.title, "New event")
    const updated = await fetch(`${base}/api/albums/${album.id}`, json("PATCH", { title: "Renamed", description: "Details" }))
    assert.equal(updated.status, 200)
    assert.equal(loadAlbums(file).find((a) => a.id === album.id)?.description, "Details")
    const added = await fetch(`${base}/api/albums/${album.id}/photos`, json("PATCH", { photoIds: ["one", "two"] }))
    assert.equal(added.status, 200)
    const members = await added.json()
    assert.equal(members.length, 2)
    assert.equal(photos.find((p) => p.id === "one")?.albumId, "a")
    assert.equal((await (await fetch(`${base}/api/photos`)).json()).length, 2)
    await fetch(`${base}/api/albums/${album.id}/photos`, json("PATCH", { photoIds: ["one", "two"] }))
    assert.equal((await (await fetch(`${base}/api/photos?albumId=${album.id}`)).json()).length, 2)
    const order = [members[1].id, members[0].id]
    assert.equal((await fetch(`${base}/api/collages`, json("POST", { albumId: album.id, name: "Preview", templateId: "grid", photoIds: order }))).status, 201)
    const reordered = await fetch(`${base}/api/albums/${album.id}/photos/order`, json("PATCH", { photoIds: order }))
    assert.equal(reordered.status, 200)
    assert.deepEqual((await reordered.json()).map((p: { id: string }) => p.id), order)
    assert.deepEqual(loadPhotos(photosFile).filter((p) => p.albumId === album.id).sort((a, b) => a.position! - b.position!).map((p) => p.id), order)
    assert.equal((await fetch(`${base}/api/albums/${album.id}`, { method: "DELETE" })).status, 204)
    assert.equal((await fetch(`${base}/api/albums/${album.id}`)).status, 404)
    assert.equal(loadAlbums(file).some((a) => a.id === album.id), false)
    assert.equal(loadCollages(collagesFile).some((c) => c.albumId === album.id), false)
    assert.equal(loadCollages(collagesFile).some((c) => c.albumId === "a"), true)
    assert.ok(loadPhotos(photosFile).filter((p) => order.includes(p.id)).every((p) => p.albumId === ""))
    assert.equal(readFileSync(join(uploads, "one.png"), "utf8"), "image bytes")
    assert.equal((await fetch(`${base}/api/uploads/one.png`)).status, 200)
  })
})

test("album writes reject malformed, oversized and foreign input before changing records", async () => {
  await fixture(async ({ base, albums, photos }) => {
    const snapshot = JSON.stringify({ albums, photos })
    for (const body of [null, {}, { title: " " }, { title: "x".repeat(201) }, { title: "A", description: 1 }]) {
      assert.equal((await fetch(`${base}/api/albums`, json("POST", body))).status, 400)
    }
    assert.equal((await fetch(`${base}/api/albums`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).status, 400)
    assert.equal((await fetch(`${base}/api/albums`, { method: "POST", body: "not JSON" })).status, 415)
    assert.equal((await fetch(`${base}/api/albums`, json("POST", { title: "x".repeat(100000) }))).status, 413)
    assert.equal((await fetch(`${base}/api/albums/foreign`, json("PATCH", { title: "X" }))).status, 404)
    assert.equal((await fetch(`${base}/api/albums/foreign`, { method: "DELETE" })).status, 404)
    for (const photoIds of [null, ["one", "one"], [1], [""]]) {
      assert.equal((await fetch(`${base}/api/albums/a/photos`, json("PATCH", { photoIds }))).status, 400)
    }
    assert.equal((await fetch(`${base}/api/albums/a/photos`, json("PATCH", { photoIds: ["private"] }))).status, 404)
    assert.equal((await fetch(`${base}/api/albums/a/photos/order`, json("PATCH", { photoIds: ["one"] }))).status, 400)
    assert.equal((await fetch(`${base}/api/albums/a/photos/order`, json("PATCH", { photoIds: ["one", "private"] }))).status, 404)
    assert.equal(JSON.stringify({ albums, photos }), snapshot)
  })
})

test("failed album saves roll back memory and already-persisted photo changes", async () => {
  await fixture(async ({ base, albums, photos, file, photosFile, collages, collagesFile, fail }) => {
    const before = JSON.stringify({ albums, photos })
    fail(true)
    assert.equal((await fetch(`${base}/api/albums`, json("POST", { title: "Unsaved" }))).status, 500)
    assert.equal((await fetch(`${base}/api/albums/a`, json("PATCH", { title: "Unsaved" }))).status, 500)
    assert.equal((await fetch(`${base}/api/albums/a`, { method: "DELETE" })).status, 500)
    assert.equal(JSON.stringify({ albums, photos }), before)
    assert.deepEqual(loadAlbums(file), albums)
    assert.deepEqual(loadPhotos(photosFile), photos)
    assert.deepEqual(loadCollages(collagesFile), collages)
  })
})

test("uploads persist and serve exact bytes, rejecting empty/foreign/unsupported requests", async () => {
  await fixture(async ({ base, photosFile }) => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const uploaded = await fetch(`${base}/api/albums/a/photos`, { method: "POST", headers: { "content-type": "image/png", "x-file-name": "memory.png" }, body: bytes })
    assert.equal(uploaded.status, 201)
    const photo = await uploaded.json()
    assert.equal(photo.title, "memory")
    assert.equal(loadPhotos(photosFile).some((p) => p.id === photo.id), true)
    const served = await fetch(base + photo.src)
    assert.equal(served.headers.get("content-type"), "image/png")
    assert.deepEqual(new Uint8Array(await served.arrayBuffer()), bytes)
    assert.equal((await fetch(`${base}/api/albums/a/photos`, { method: "POST", headers: { "content-type": "image/png" } })).status, 400)
    assert.equal((await fetch(`${base}/api/albums/a/photos`, { method: "POST", body: "pdf" })).status, 415)
    assert.equal((await fetch(`${base}/api/albums/foreign/photos`, { method: "POST", headers: { "content-type": "image/png" }, body: bytes })).status, 404)
  })
})

test("replacing a photo image swaps the file, persists it, and rejects foreign or bad requests", async () => {
  await fixture(async ({ base, photosFile, uploads }) => {
    const bytes = new Uint8Array([255, 216, 255, 224])
    const put = (id: string, init: RequestInit) => fetch(`${base}/api/photos/${id}/image`, { method: "PUT", ...init })

    const res = await put("one", { headers: { "content-type": "image/jpeg" }, body: bytes })
    assert.equal(res.status, 200)
    const updated = await res.json()
    assert.ok(updated.src.endsWith(".jpg"))
    assert.notEqual(updated.src, "/api/uploads/one.png")
    assert.equal(existsSync(join(uploads, "one.png")), false)
    assert.deepEqual(new Uint8Array(await (await fetch(base + updated.src)).arrayBuffer()), bytes)
    assert.equal(loadPhotos(photosFile).find((p) => p.id === "one")?.src, updated.src)

    assert.equal((await put("private", { headers: { "content-type": "image/jpeg" }, body: bytes })).status, 404)
    assert.equal((await put("two", { body: "x" })).status, 415)
    assert.equal((await put("two", { headers: { "content-type": "image/png" } })).status, 400)
  })
})
