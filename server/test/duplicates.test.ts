import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import type { Album } from "../src/albums.ts"
import { createAlbumServer } from "../src/http.ts"
import { savePhotos } from "../src/photo-store.ts"
import type { StoredPhoto } from "../src/photos.ts"

const albums: Album[] = [
  { id: "opening", title: "Opening ceremony", ownerId: "demo-user" },
  { id: "dinner", title: "Dinner", ownerId: "demo-user" },
  { id: "secret", title: "Not yours", ownerId: "other-user" },
]

function photo(id: string, file: string, albumId: string, ownerId = "demo-user", title = id): StoredPhoto {
  return {
    id,
    src: `/api/uploads/${file}`,
    thumbnail: `/api/uploads/${file}`,
    title,
    description: "",
    date: "2026-11-13",
    albumId,
    tags: [],
    ownerId,
    file,
  }
}

async function startServer(photos: StoredPhoto[], bytes: Record<string, string>, save?: (all: StoredPhoto[]) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), "duplicates-"))
  const uploadsDir = path.join(dir, "uploads")
  mkdirSync(uploadsDir)
  for (const [file, content] of Object.entries(bytes)) writeFileSync(path.join(uploadsDir, file), content)
  const photosFile = path.join(dir, "photos.json")
  const storage = { photos, uploadsDir, save: save ?? ((all: StoredPhoto[]) => savePhotos(photosFile, all)) }
  const server = createAlbumServer({ albums, ownerId: "demo-user", photoStorage: storage })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("test server did not bind a port")
  return {
    base: `http://127.0.0.1:${address.port}`,
    dir,
    uploadsDir,
    photosFile,
    photos,
    server,
    async close() {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

test("duplicate scan hashes bytes, scopes owners and albums before reading, and keeps the first photo", async () => {
  const photos = [
    photo("first", "first.jpg", "opening"),
    photo("second", "second.webp", "opening"),
    photo("different", "different.jpg", "opening", "demo-user", "same-original-filename"),
    photo("different-too", "different-too.jpg", "opening", "demo-user", "same-original-filename"),
    photo("elsewhere", "elsewhere.gif", "dinner"),
    photo("foreign", "../foreign.jpg", "opening", "other-user"),
  ]
  const server = await startServer(photos, {
    "first.jpg": "same image",
    "second.webp": "same image",
    "different.jpg": "different image",
    "different-too.jpg": "yet another image",
    "elsewhere.gif": "same image",
  })
  writeFileSync(path.join(server.dir, "foreign.jpg"), "same image")
  try {
    // The foreign photo points outside uploads; success proves owner filtering happened before hashing.
    const all = await fetch(`${server.base}/api/photos/duplicates`)
    assert.equal(all.status, 200)
    const groups = await all.json()
    assert.equal(groups.length, 1)
    assert.equal(groups[0].keeper.id, "first")
    assert.deepEqual(groups[0].duplicates.map((p: { id: string }) => p.id), ["second", "elsewhere"])

    const opening = await fetch(`${server.base}/api/photos/duplicates?albumId=opening`)
    assert.equal(opening.status, 200)
    const albumGroups = await opening.json()
    assert.equal(albumGroups.length, 1)
    assert.equal(albumGroups[0].keeper.id, "first")
    assert.deepEqual(albumGroups[0].duplicates.map((p: { id: string }) => p.id), ["second"])
    assert.equal(photos.find((p) => p.id === "foreign")?.ownerId, "other-user")
  } finally {
    await server.close()
  }
})

test("one upload in multiple albums is not reported as a duplicate", async () => {
  const photos = [photo("opening-membership", "same.jpg", "opening"), photo("dinner-membership", "same.jpg", "dinner")]
  const server = await startServer(photos, { "same.jpg": "same image" })
  try {
    assert.deepEqual(await (await fetch(`${server.base}/api/photos/duplicates`)).json(), [])
    assert.deepEqual(await (await fetch(`${server.base}/api/photos/duplicates?albumId=opening`)).json(), [])
  } finally {
    await server.close()
  }
})

test("album duplicate removal detaches; library removal deletes metadata everywhere and persists", async () => {
  const photos = [
    photo("first", "first.jpg", "opening"),
    photo("copy", "copy.jpg", "opening"),
    photo("other-copy", "other-copy.jpg", "dinner"),
    photo("shared-copy", "other-copy.jpg", "dinner"),
    photo("foreign-copy", "other-copy.jpg", "secret", "other-user"),
  ]
  const server = await startServer(photos, {
    "first.jpg": "same image",
    "copy.jpg": "same image",
    "other-copy.jpg": "same image",
  })
  try {
    const detached = await fetch(`${server.base}/api/photos/duplicates/copy?albumId=opening`, { method: "DELETE" })
    assert.equal(detached.status, 204)
    const album = await (await fetch(`${server.base}/api/photos?albumId=opening`)).json()
    assert.deepEqual(album.map((p: { id: string }) => p.id), ["first"])
    const library = await (await fetch(`${server.base}/api/photos`)).json()
    assert.deepEqual(library.map((p: { id: string }) => p.id), ["first", "copy", "other-copy"])
    assert.equal((await fetch(`${server.base}/api/uploads/copy.jpg`)).status, 200)
    assert.equal(JSON.parse(readFileSync(server.photosFile, "utf8")).find((p: StoredPhoto) => p.id === "copy").albumId, "")

    const removed = await fetch(`${server.base}/api/photos/duplicates/other-copy`, { method: "DELETE" })
    assert.equal(removed.status, 204)
    const afterDelete = await (await fetch(`${server.base}/api/photos`)).json()
    assert.deepEqual(afterDelete.map((p: { id: string }) => p.id), ["first", "copy"])
    assert.equal((await fetch(`${server.base}/api/photos?albumId=opening`)).status, 200)
    assert.deepEqual((await (await fetch(`${server.base}/api/photos?albumId=opening`)).json()).map((p: { id: string }) => p.id), ["first"])
    assert.deepEqual((await (await fetch(`${server.base}/api/photos?albumId=dinner`)).json()).map((p: { id: string }) => p.id), [])
    assert.equal((await fetch(`${server.base}/api/uploads/other-copy.jpg`)).status, 404)
    assert.deepEqual(JSON.parse(readFileSync(server.photosFile, "utf8")).map((p: StoredPhoto) => p.id), ["first", "copy", "foreign-copy"])
    assert.equal(photos.some((p) => p.id === "foreign-copy" && p.ownerId === "other-user"), true)
    // The other owner's record keeps the shared upload bytes even though this user lost every membership.
    assert.equal(existsSync(path.join(server.uploadsDir, "other-copy.jpg")), true)
    assert.equal(readFileSync(path.join(server.uploadsDir, "other-copy.jpg"), "utf8"), "same image")
  } finally {
    await server.close()
  }
})

test("library removal targets one physical duplicate and removes all owner memberships only", async () => {
  const photos = [
    photo("keeper", "keeper.jpg", "opening"),
    photo("copy-opening", "copy.jpg", "opening"),
    photo("copy-dinner", "copy.jpg", "dinner"),
    photo("foreign-copy", "copy.jpg", "secret", "other-user"),
  ]
  const server = await startServer(photos, { "keeper.jpg": "same image", "copy.jpg": "same image" })
  try {
    const groups = await (await fetch(`${server.base}/api/photos/duplicates`)).json()
    assert.equal(groups.length, 1)
    assert.deepEqual(groups[0].duplicates.map((p: { id: string }) => p.id), ["copy-opening"])

    const removed = await fetch(`${server.base}/api/photos/duplicates/delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoIds: ["copy-opening"] }),
    })
    assert.equal(removed.status, 204)
    assert.deepEqual(photos.map((p) => p.id), ["keeper", "foreign-copy"])
    assert.deepEqual((await (await fetch(`${server.base}/api/photos`)).json()).map((p: { id: string }) => p.id), ["keeper"])
    assert.equal(existsSync(path.join(server.uploadsDir, "copy.jpg")), true)
    assert.equal(readFileSync(path.join(server.uploadsDir, "copy.jpg"), "utf8"), "same image")
  } finally {
    await server.close()
  }
})

test("album removal detaches selected upload memberships only from that album", async () => {
  const photos = [
    photo("keeper", "keeper.jpg", "opening"),
    photo("copy-opening", "copy.jpg", "opening"),
    photo("copy-opening-alias", "copy.jpg", "opening"),
    photo("copy-dinner", "copy.jpg", "dinner"),
  ]
  const server = await startServer(photos, { "keeper.jpg": "same image", "copy.jpg": "same image" })
  try {
    const groups = await (await fetch(`${server.base}/api/photos/duplicates?albumId=opening`)).json()
    assert.deepEqual(groups[0].duplicates.map((p: { id: string }) => p.id), ["copy-opening"])

    const removed = await fetch(`${server.base}/api/photos/duplicates/delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ albumId: "opening", photoIds: ["copy-opening"] }),
    })
    assert.equal(removed.status, 204)
    assert.deepEqual((await (await fetch(`${server.base}/api/photos?albumId=opening`)).json()).map((p: { id: string }) => p.id), ["keeper"])
    assert.deepEqual((await (await fetch(`${server.base}/api/photos?albumId=dinner`)).json()).map((p: { id: string }) => p.id), ["copy-dinner"])
    assert.deepEqual(photos.map(({ id, albumId }) => [id, albumId]), [
      ["keeper", "opening"],
      ["copy-opening", ""],
      ["copy-opening-alias", ""],
      ["copy-dinner", "dinner"],
    ])
    assert.equal((await fetch(`${server.base}/api/uploads/copy.jpg`)).status, 200)
  } finally {
    await server.close()
  }
})

test("bulk removal deletes explicit selections only, and a save failure rolls back metadata", async () => {
  const photos = [photo("first", "first.jpg", "opening"), photo("copy-a", "copy-a.jpg", "opening"), photo("copy-b", "copy-b.jpg", "opening")]
  const server = await startServer(photos, {
    "first.jpg": "same image",
    "copy-a.jpg": "same image",
    "copy-b.jpg": "same image",
  })
  try {
    const response = await fetch(`${server.base}/api/photos/duplicates/delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoIds: ["copy-a"] }),
    })
    assert.equal(response.status, 204)
    assert.deepEqual(photos.map((p) => p.id), ["first", "copy-b"])
    assert.deepEqual(JSON.parse(readFileSync(server.photosFile, "utf8")).map((p: StoredPhoto) => p.id), ["first", "copy-b"])
    assert.equal(existsSync(path.join(server.uploadsDir, "copy-a.jpg")), false)
  } finally {
    await server.close()
  }

  const albumPhotos = [photo("first", "first.jpg", "opening"), photo("copy-a", "copy-a.jpg", "opening"), photo("copy-b", "copy-b.jpg", "opening")]
  const albumServer = await startServer(albumPhotos, {
    "first.jpg": "same image",
    "copy-a.jpg": "same image",
    "copy-b.jpg": "same image",
  })
  try {
    const response = await fetch(`${albumServer.base}/api/photos/duplicates/delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ albumId: "opening", photoIds: ["copy-a"] }),
    })
    assert.equal(response.status, 204)
    assert.deepEqual((await (await fetch(`${albumServer.base}/api/photos?albumId=opening`)).json()).map((p: { id: string }) => p.id), ["first", "copy-b"])
    assert.deepEqual((await (await fetch(`${albumServer.base}/api/photos`)).json()).map((p: { id: string }) => p.id), ["first", "copy-a", "copy-b"])
    assert.equal((await fetch(`${albumServer.base}/api/uploads/copy-a.jpg`)).status, 200)
  } finally {
    await albumServer.close()
  }

  const failingPhotos = [photo("first", "first.jpg", "opening"), photo("copy", "copy.jpg", "opening")]
  const failed = await startServer(failingPhotos, { "first.jpg": "same", "copy.jpg": "same" }, () => {
    throw new Error("simulated persistence failure")
  })
  writeFileSync(failed.photosFile, JSON.stringify(failingPhotos))
  try {
    const response = await fetch(`${failed.base}/api/photos/duplicates/copy`, { method: "DELETE" })
    assert.equal(response.status, 500)
    assert.deepEqual(failingPhotos.map((p) => p.id), ["first", "copy"])
    assert.deepEqual(JSON.parse(readFileSync(failed.photosFile, "utf8")).map((p: StoredPhoto) => p.id), ["first", "copy"])
    assert.equal(existsSync(path.join(failed.uploadsDir, "copy.jpg")), true)
    assert.equal((await fetch(`${failed.base}/api/uploads/copy.jpg`)).status, 200)
  } finally {
    await failed.close()
  }
})

test("bulk deletion preserves a new duplicate uploaded after the scan", async () => {
  const photos = [photo("keeper", "keeper.jpg", "opening"), photo("selected", "selected.jpg", "opening")]
  const server = await startServer(photos, { "keeper.jpg": "same image", "selected.jpg": "same image" })
  try {
    const scan = await fetch(`${server.base}/api/photos/duplicates`)
    assert.equal(scan.status, 200)
    const groups = await scan.json()
    assert.deepEqual(groups[0].duplicates.map((p: { id: string }) => p.id), ["selected"])

    const uploaded = await fetch(`${server.base}/api/albums/opening/photos`, {
      method: "POST",
      headers: { "content-type": "image/jpeg", "x-file-name": "arrived-after-scan.jpg" },
      body: "same image",
    })
    assert.equal(uploaded.status, 201)
    const created = await uploaded.json()

    const removed = await fetch(`${server.base}/api/photos/duplicates/delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoIds: ["selected"] }),
    })
    assert.equal(removed.status, 204)
    assert.deepEqual(photos.map((p) => p.id), ["keeper", created.id])
    assert.equal(existsSync(path.join(server.uploadsDir, "selected.jpg")), false)

    const after = await (await fetch(`${server.base}/api/photos/duplicates`)).json()
    assert.deepEqual(after[0].duplicates.map((p: { id: string }) => p.id), [created.id])
  } finally {
    await server.close()
  }
})

test("bulk delete rejects invalid, foreign, keeper, stale, and null-album targets", async () => {
  const photos = [
    photo("first", "first.jpg", "opening"),
    photo("copy", "copy.jpg", "opening"),
    photo("foreign", "first.jpg", "secret", "other-user"),
  ]
  const server = await startServer(photos, { "first.jpg": "same image", "copy.jpg": "same image" })
  const remove = (body: unknown) => fetch(`${server.base}/api/photos/duplicates/delete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  try {
    for (const body of [
      { photoIds: [] },
      { photoIds: ["copy", "copy"] },
    ]) assert.equal((await remove(body)).status, 400)

    for (const body of [
      { photoIds: ["first"] },
      { photoIds: ["foreign"] },
      { photoIds: ["stale"] },
      { albumId: null, photoIds: ["copy"] },
    ]) assert.equal((await remove(body)).status, body.albumId === null ? 400 : 409)

    assert.deepEqual(photos.map((p) => p.id), ["first", "copy", "foreign"])
    assert.equal((await fetch(`${server.base}/api/uploads/copy.jpg`)).status, 200)

    const detachedKeeper = await fetch(`${server.base}/api/albums/opening/photos/first`, { method: "DELETE" })
    assert.equal(detachedKeeper.status, 204)
    assert.equal((await remove({ albumId: "opening", photoIds: ["copy"] })).status, 409)
    assert.deepEqual((await (await fetch(`${server.base}/api/photos?albumId=opening`)).json()).map((p: { id: string }) => p.id), ["copy"])
  } finally {
    await server.close()
  }
})

test("a post-save cleanup failure does not roll back deleted metadata", async () => {
  let photosFile = ""
  let blockedUpload = ""
  const photos = [photo("first", "first.jpg", "opening"), photo("copy", "copy.jpg", "opening")]
  const server = await startServer(photos, { "first.jpg": "same image", "copy.jpg": "same image" }, (all) => {
    savePhotos(photosFile, all)
    unlinkSync(blockedUpload)
    mkdirSync(blockedUpload)
  })
  photosFile = server.photosFile
  blockedUpload = path.join(server.uploadsDir, "copy.jpg")
  try {
    const response = await fetch(`${server.base}/api/photos/duplicates/copy`, { method: "DELETE" })
    assert.equal(response.status, 204)
    assert.deepEqual(photos.map((p) => p.id), ["first"])
    assert.deepEqual(JSON.parse(readFileSync(photosFile, "utf8")).map((p: StoredPhoto) => p.id), ["first"])
  } finally {
    await server.close()
  }
})

test("out-of-directory owned file blocks duplicate action without changing records", async () => {
  const outsideName = `outside-owned-${Date.now()}.jpg`
  const photos = [photo("first", "first.jpg", "opening"), photo("unsafe", `../${outsideName}`, "opening")]
  const server = await startServer(photos, { "first.jpg": "same" })
  writeFileSync(path.join(server.dir, outsideName), "same")
  try {
    const response = await fetch(`${server.base}/api/photos/duplicates/delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoIds: ["unsafe"] }),
    })
    assert.equal(response.status, 500)
    assert.deepEqual(photos.map((p) => p.id), ["first", "unsafe"])
  } finally {
    await server.close()
  }
})
