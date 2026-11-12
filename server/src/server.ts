import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { CURRENT_USER_ID } from "./current-user.ts"
import { createAlbumServer } from "./http.ts"
import { loadPhotos, savePhotos } from "./photo-store.ts"
import { loadAlbums } from "./store.ts"
import { loadUsers } from "./user-store.ts"

const dataFile = fileURLToPath(new URL("../data/albums.json", import.meta.url))
const photosFile = fileURLToPath(new URL("../data/photos.json", import.meta.url))
const uploadsDir = fileURLToPath(new URL("../data/uploads", import.meta.url))
const usersFile = fileURLToPath(new URL("../data/users.json", import.meta.url))
mkdirSync(uploadsDir, { recursive: true })

const photos = loadPhotos(photosFile)
const server = createAlbumServer({
  albums: loadAlbums(dataFile),
  ownerId: CURRENT_USER_ID,
  users: loadUsers(usersFile),
  photoStorage: { photos, uploadsDir, save: (all) => savePhotos(photosFile, all) },
})

server.listen(port, () => {
  console.log(`Album API on http://localhost:${port}`)
})
