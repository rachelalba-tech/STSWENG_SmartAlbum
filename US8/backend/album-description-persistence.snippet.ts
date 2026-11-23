/* server/src/albums.ts — Album type */
description?: string

/* server/src/store.ts — include in isAlbum validation */
    typeof album.id === "string" &&
    album.id !== "" &&
    typeof album.title === "string" &&
    (album.description === undefined || typeof album.description === "string") &&
    typeof album.ownerId === "string"
  )
}


/* server/src/store.ts — persistence helper */
  }
  return parsed
}

export function saveAlbums(file: string, albums: Album[]): void {
  const tmp = `${file}.tmp`

/* server/src/server.ts — wire persistence into createAlbumServer */
saveAlbums: (all) => saveAlbums(dataFile, all),
