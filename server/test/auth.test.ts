import assert from "node:assert/strict"
import { scryptSync } from "node:crypto"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { createAlbumServer } from "../src/http.ts"
import { authenticateUser, type User } from "../src/users.ts"
import { loadUsers } from "../src/user-store.ts"

const salt = "a".repeat(32)
const users: User[] = ["admin", "member"].map((id) => ({ id, username: id, role: id === "admin" ? "admin" : "user", salt, passwordHash: scryptSync("password", salt, 64).toString("hex") }))
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

async function fixture(run: (base: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "smartalbum-auth-"))
  mkdirSync(join(dir, "uploads"))
  writeFileSync(join(dir, "uploads", "private.png"), "private bytes")
  const server = createAlbumServer({
    ownerId: "admin", users, albums: [{ id: "a", title: "Admin", ownerId: "admin" }, { id: "m", title: "Member", ownerId: "member" }], saveAlbums: () => {},
    photoStorage: { uploadsDir: join(dir, "uploads"), save: () => {}, photos: [{ id: "p", src: "/api/uploads/private.png", thumbnail: "/api/uploads/private.png", file: "private.png", title: "Private", date: "", description: "", tags: [], ownerId: "admin", albumId: "a" }] },
    collageStorage: { collages: [{ id: "c", albumId: "a", ownerId: "admin", name: "Private", templateId: "grid", photoIds: ["p"], createdAt: "", updatedAt: "" }], save: () => {} },
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  try { await run(`http://127.0.0.1:${address.port}`) } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    rmSync(dir, { recursive: true, force: true })
  }
}

async function signIn(base: string, username = "admin", headers: Record<string, string> = {}) {
  const init = json({ username, password: "password" })
  const res = await fetch(base + "/api/login", { ...init, headers: { ...init.headers, ...headers } })
  assert.equal(res.status, 200)
  return { res, cookie: res.headers.get("set-cookie")!.split(";")[0] }
}

test("hashed credentials and seed validation never expose password material", async () => {
  assert.deepEqual(await authenticateUser(users, "admin", "password"), { id: "admin", username: "admin", role: "admin" })
  assert.equal(await authenticateUser(users, "admin", "wrong"), undefined)
  assert.equal(await authenticateUser(users, "missing", "password"), undefined)
  const seed = loadUsers(fileURLToPath(new URL("../data/users.json", import.meta.url)))
  assert.deepEqual(await authenticateUser(seed, "test", "tester123"), { id: "demo-user", username: "test", role: "admin" })
  const dir = mkdtempSync(join(tmpdir(), "user-store-"))
  const file = join(dir, "users.json")
  try {
    for (const bad of [[{ id: "u", username: "u", password: "plaintext" }], [users[0], users[0]], [{ ...users[0], passwordHash: "bad" }]]) {
      writeFileSync(file, JSON.stringify(bad)); assert.throws(() => loadUsers(file), /Invalid user/)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("all data routes reject unauthenticated and forged identities", async () => {
  await fixture(async (base) => {
    for (const route of ["/api/albums", "/api/albums/a", "/api/photos", "/api/uploads/private.png", "/api/collages"]) {
      assert.equal((await fetch(base + route, { headers: { cookie: "smart-album-session=" + "a".repeat(64), "x-user-id": "admin" } })).status, 401)
    }
    assert.equal((await fetch(base + "/api/albums", json({ title: "Bypass", ownerId: "admin" }))).status, 401)
    for (const body of [null, [], {}, { username: 1, password: "x" }, { username: "admin", password: "x".repeat(1025) }]) {
      assert.equal((await fetch(base + "/api/login", json(body))).status, 400)
    }
    assert.equal((await fetch(base + "/api/login", { method: "POST", body: "not json" })).status, 415)
    assert.equal((await fetch(base + "/api/login", { ...json({}), body: "{" })).status, 400)
    assert.equal((await fetch(base + "/api/login", json({ username: "admin", password: "wrong" }))).status, 401)
  })
})

test("sessions rotate, expire, and are revoked by logout with HTTP-only cookies", async () => {
  await fixture(async (base) => {
    const first = await signIn(base)
    assert.match(first.res.headers.get("set-cookie")!, /HttpOnly; Max-Age=28800; SameSite=Lax/)
    assert.deepEqual(await first.res.json(), { id: "admin", username: "admin", role: "admin" })
    assert.equal((await fetch(base + "/api/session", { headers: { cookie: first.cookie } })).status, 200)
    const next = await signIn(base, "admin", { cookie: first.cookie, "x-forwarded-proto": "https" })
    assert.match(next.res.headers.get("set-cookie")!, /SameSite=None; Secure/)
    assert.notEqual(next.cookie, first.cookie)
    assert.equal((await fetch(base + "/api/session", { headers: { cookie: first.cookie } })).status, 401)
    const realNow = Date.now
    Date.now = () => realNow() + 8 * 60 * 60 * 1000 + 1
    try { assert.equal((await fetch(base + "/api/session", { headers: { cookie: next.cookie } })).status, 401) }
    finally { Date.now = realNow }
    const final = await signIn(base)
    const out = await fetch(base + "/api/logout", { method: "POST", headers: { cookie: final.cookie } })
    assert.equal(out.status, 204)
    assert.match(out.headers.get("set-cookie")!, /Max-Age=0/)
    assert.equal((await fetch(base + "/api/albums", { headers: { cookie: final.cookie } })).status, 401)
  })
})

test("ownership comes from sessions, and only admins create or label albums", async () => {
  await fixture(async (base) => {
    const { cookie } = await signIn(base, "member")
    const headers = { cookie }
    assert.deepEqual((await (await fetch(base + "/api/albums", { headers })).json()).map((a: { id: string }) => a.id), ["m"])
    for (const route of ["/api/albums/a", "/api/uploads/private.png"]) assert.equal((await fetch(base + route, { headers })).status, 404)
    assert.equal((await fetch(base + "/api/collages/c", { method: "DELETE", headers })).status, 404)
    assert.deepEqual(await (await fetch(base + "/api/collages", { headers })).json(), [])
    assert.deepEqual(await (await fetch(base + "/api/photos", { headers })).json(), [])
    for (const [route, method] of [["/api/albums", "POST"], ["/api/albums/m", "PATCH"]]) {
      assert.equal((await fetch(base + route, { ...json({ title: "Fake", ownerId: "admin", role: "admin" }), method, headers: { ...headers, "content-type": "application/json" } })).status, 403)
    }
    const admin = await signIn(base)
    const created = await fetch(base + "/api/albums", { ...json({ title: "Created", ownerId: "member" }), headers: { cookie: admin.cookie, "content-type": "application/json" } })
    assert.equal(created.status, 201)
    assert.equal((await created.json()).ownerId, "admin")
  })
})

test("origin checks protect mutations and credentialed preflights remain usable", async () => {
  await fixture(async (base) => {
    const { cookie } = await signIn(base)
    for (const route of ["/api/login", "/api/logout", "/api/albums"]) assert.equal((await fetch(base + route, { ...json({ title: "Attack" }), headers: { cookie, origin: "https://evil.example", "content-type": "application/json" } })).status, 403)
    assert.equal((await fetch(base + "/api/session", { headers: { cookie } })).status, 200)
    const preflight = await fetch(base + "/api/albums", { method: "OPTIONS", headers: { origin: "http://localhost:5173" } })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get("access-control-allow-credentials"), "true")
    assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5173")
  })
})

test("login work is rate limited and recovers after the window", async () => {
  await fixture(async (base) => {
    for (let i = 0; i < 20; i++) assert.equal((await fetch(base + "/api/login", json({ username: "admin", password: "wrong" }))).status, 401)
    const blocked = await fetch(base + "/api/login", json({ username: "admin", password: "password" }))
    assert.equal(blocked.status, 429)
    assert.equal(blocked.headers.get("retry-after"), "60")
    const realNow = Date.now
    Date.now = () => realNow() + 60_001
    try { await signIn(base) } finally { Date.now = realNow }
  })
})
