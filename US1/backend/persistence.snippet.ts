/* server/src/store.ts — update imports and add this complete helper. */
import { readFileSync, renameSync, writeFileSync } from "node:fs"

export function saveAlbums(file: string, albums: Album[]): void {
  const temporaryFile = `${file}.tmp`
  writeFileSync(temporaryFile, JSON.stringify(albums, null, 2))
  renameSync(temporaryFile, file)
}

/* server/src/server.ts — import saveAlbums from ./store.ts and pass this option to createAlbumServer. */
saveAlbums: (all) => saveAlbums(dataFile, all),
