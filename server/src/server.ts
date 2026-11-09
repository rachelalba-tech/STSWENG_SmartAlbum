import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { CURRENT_USER_ID } from "./current-user.ts"
import { loadCollages, saveCollages } from "./collage-store.ts"
import { createAlbumServer } from "./http.ts"
import { loadPhotos, savePhotos } from "./photo-store.ts"
import { loadAlbums } from "./store.ts"

const dataFile = fileURLToPath(new URL("../data/albums.json", import.meta.url))
const photosFile = fileURLToPath(new URL("../data/photos.json", import.meta.url))
const collagesFile = fileURLToPath(new URL("../data/collages.json", import.meta.url))
const uploadsDir = fileURLToPath(new URL("../data/uploads", import.meta.url))
mkdirSync(uploadsDir, { recursive: true })

const photos = loadPhotos(photosFile)
const collages = loadCollages(collagesFile)
const server = createAlbumServer({
  albums: loadAlbums(dataFile),
  ownerId: CURRENT_USER_ID,
  photoStorage: { photos, uploadsDir, save: (all) => savePhotos(photosFile, all) },
  collageStorage: { collages, save: (all) => saveCollages(collagesFile, all) },
})

server.listen(3000, () => {
  console.log("Album API on http://localhost:3000")
})