import assert from "node:assert/strict"
import { randomBytes, scryptSync } from "node:crypto"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"
import { build, preview } from "../frontend/node_modules/vite/dist/node/index.js"
import { createAlbumServer } from "../server/src/http.ts"
import { loadAlbums, saveAlbums } from "../server/src/store.ts"
import { loadPhotos, savePhotos } from "../server/src/photo-store.ts"
import { saveCollages } from "../server/src/collage-store.ts"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const results = join(root, "tests", "results")
mkdirSync(results, { recursive: true })
const data = mkdtempSync(join(tmpdir(), "smartalbum-browser-"))
const albumsFile = join(data, "albums.json")
const photosFile = join(data, "photos.json")
const uploads = join(data, "uploads")
mkdirSync(uploads)
saveAlbums(albumsFile, [])
savePhotos(photosFile, [])
const salt = randomBytes(16).toString("hex")
const server = createAlbumServer({
  albums: [], ownerId: "qa-admin", saveAlbums: (all) => saveAlbums(albumsFile, all),
  users: [{ id: "qa-admin", username: "test", role: "admin", salt, passwordHash: scryptSync("tester123", salt, 64).toString("hex") }],
  photoStorage: { photos: [], uploadsDir: uploads, save: (all) => savePhotos(photosFile, all) },
  collageStorage: { collages: [], save: (all) => saveCollages(join(data, "collages.json"), all) },
})
const log = []
server.on("request", (req, res) => res.on("finish", () => log.push(`${req.method} ${req.url} ${res.statusCode}`)))
let web
try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
  const apiUrl = `http://127.0.0.1:${server.address().port}`
  // Override .env and proxy settings: this build can only access disposable local data.
  const config = {
    root: join(root, "frontend"), configFile: join(root, "frontend", "vite.config.ts"),
    define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
    build: { outDir: join(data, "dist"), emptyOutDir: true },
    preview: { host: "127.0.0.1", port: 0, proxy: { "/api": apiUrl } },
  }
  await build(config)
  web = await preview(config)
  const url = `http://127.0.0.1:${web.httpServer.address().port}`
  console.log(`Isolated browser target: ${url}; API: ${apiUrl}`)
  const code = await new Promise((resolve, reject) => {
    const robot = spawn(process.argv[2] ?? process.env.ROBOT_PYTHON ?? "python", [
      "-m", "robot", "--outputdir", results, "--variable", `ALBUMS_URL:${url}`,
      "--variable", `BROWSER:${process.env.ROBOT_BROWSER ?? "headlesschrome"}`, join(root, "tests"),
    ], { stdio: "inherit" })
    robot.once("error", reject)
    robot.once("exit", (status) => resolve(status ?? 1))
  })
  if (code === 0) {
    const albums = loadAlbums(albumsFile)
    const photos = loadPhotos(photosFile)
    assert.ok(albums.length > 0 && photos.length > 0, "browser tests must persist actual data")
    for (const photo of photos) assert.ok(readFileSync(join(uploads, photo.file)).length > 0)
    console.log(`Persistence self-check: ${albums.length} albums, ${photos.length} photo memberships`)
  }
  process.exitCode = code
} finally {
  if (web) await new Promise((resolve) => web.httpServer.close(resolve))
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  writeFileSync(join(results, "api.log"), log.join("\n"))
  rmSync(data, { recursive: true, force: true })
}
