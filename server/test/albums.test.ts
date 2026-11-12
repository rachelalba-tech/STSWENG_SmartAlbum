import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { listAlbumsForUser, openAlbum, type Album } from "../src/albums.ts"
import { CURRENT_USER_ID } from "../src/current-user.ts"
import { createAlbumServer } from "../src/http.ts"
import { loadAlbums } from "../src/store.ts"
import { loadUsers } from "../src/user-store.ts"
import type { User } from "../src/users.ts"

const mixed: Album[] = [
  { id: "a", title: "Opening ceremony", ownerId: "demo-user" },
  { id: "b", title: "Someone else", ownerId: "other-user" },
  { id: "c", title: "Reception", ownerId: "demo-user" },
  { id: "d", title: "After party", ownerId: "demo-user" },
]

test("lists every album belonging to the user and no others", () => {
  assert.deepEqual(listAlbumsForUser(mixed, "demo-user"), [mixed[0], mixed[2], mixed[3]])
  assert.deepEqual(listAlbumsForUser(mixed, "nobody"), [])
})

test("opens an owned album and hides the rest", () => {
  assert.deepEqual(openAlbum(mixed, "demo-user", "c"), mixed[2])
  assert.equal(openAlbum(mixed, "demo-user", "b"), undefined)
  assert.equal(openAlbum(mixed, "demo-user", "missing"), undefined)
})

test("loads the seed file without dropping the demo user's albums", () => {
  const seed = fileURLToPath(new URL("../data/albums.json", import.meta.url))
  const albums = loadAlbums(seed)
  const listed = listAlbumsForUser(albums, CURRENT_USER_ID)
  assert.deepEqual(listed, albums.filter((album) => album.ownerId === CURRENT_USER_ID))
  assert.ok(listed.length >= 1)
})

test("rejects an album file that is not a list of albums", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "albums-"))
  const file = path.join(dir, "albums.json")
  writeFileSync(file, '{"nope":true}')
  assert.throws(() => loadAlbums(file), /Invalid album file/)
})

async function withServer(
  albums: Album[],
  ownerId: string,
  run: (base: string) => Promise<void>,
  users: User[] = [],
) {
  const server = createAlbumServer({ albums, ownerId, users })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    server.close()
    throw new Error("test server did not bind a port")
  }
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

test("GET /api/albums returns every album for the user", async () => {
  await withServer(mixed, "demo-user", async (base) => {
    const res = await fetch(`${base}/api/albums`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), [mixed[0], mixed[2], mixed[3]])
  })
})

test("loads the seeded login user from the data store", () => {
  const seed = fileURLToPath(new URL("../data/users.json", import.meta.url))
  assert.deepEqual(loadUsers(seed), [
    { id: "demo-user", username: "test", password: "tester123" },
  ])
})

test("POST /api/login accepts the seeded credentials without returning the password", async () => {
  const users: User[] = [{ id: "demo-user", username: "test", password: "tester123" }]
  await withServer(
    mixed,
    "demo-user",
    async (base) => {
      const res = await fetch(`${base}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "test", password: "tester123" }),
      })
      assert.equal(res.status, 200)
      assert.deepEqual(await res.json(), { id: "demo-user", username: "test" })
    },
    users,
  )
})

test("POST /api/login rejects incorrect credentials", async () => {
  const users: User[] = [{ id: "demo-user", username: "test", password: "tester123" }]
  await withServer(
    mixed,
    "demo-user",
    async (base) => {
      const res = await fetch(`${base}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "test", password: "wrong" }),
      })
      assert.equal(res.status, 401)
      assert.deepEqual(await res.json(), { error: "invalid username or password" })
    },
    users,
  )
})

test("GET /api/albums/:id decodes the album id", async () => {
  const albums = [{ id: "a b", title: "Spaced", ownerId: "demo-user" }]
  await withServer(albums, "demo-user", async (base) => {
    const res = await fetch(`${base}/api/albums/${encodeURIComponent("a b")}`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), albums[0])
  })
})

test("GET /api/albums/:id opens an owned album and 404s otherwise", async () => {
  await withServer(mixed, "demo-user", async (base) => {
    const opened = await fetch(`${base}/api/albums/c`)
    assert.equal(opened.status, 200)
    assert.deepEqual(await opened.json(), mixed[2])

    const hidden = await fetch(`${base}/api/albums/b`)
    assert.equal(hidden.status, 404)

    const missing = await fetch(`${base}/api/albums/missing`)
    assert.equal(missing.status, 404)
  })
})
