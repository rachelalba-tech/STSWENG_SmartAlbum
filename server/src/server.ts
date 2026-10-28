import { fileURLToPath } from "node:url"
import { CURRENT_USER_ID } from "./current-user.ts"
import { createAlbumServer } from "./http.ts"
import { loadAlbums } from "./store.ts"

const dataFile = fileURLToPath(new URL("../data/albums.json", import.meta.url))
const server = createAlbumServer({
  albums: loadAlbums(dataFile),
  ownerId: CURRENT_USER_ID,
})

server.listen(3000, () => {
  console.log("Album API on http://localhost:3000")
})
