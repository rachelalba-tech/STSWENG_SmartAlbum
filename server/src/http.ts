import { createServer, type Server, type ServerResponse } from "node:http"
import { listAlbumsForUser, openAlbum, type Album } from "./albums.ts"

type Options = {
  albums: Album[]
  ownerId: string
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
  })
  res.end(json)
}

export function createAlbumServer({ albums, ownerId }: Options): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    if (req.method !== "GET") {
      send(res, 405, { error: "method not allowed" })
      return
    }
    if (url.pathname === "/api/albums") {
      send(res, 200, listAlbumsForUser(albums, ownerId))
      return
    }
    const match = url.pathname.match(/^\/api\/albums\/([^/]+)$/)
    if (match) {
      const album = openAlbum(albums, ownerId, decodeURIComponent(match[1]))
      send(res, album ? 200 : 404, album ?? { error: "album not found" })
      return
    }
    send(res, 404, { error: "not found" })
  })
}
