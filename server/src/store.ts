import { readFileSync } from "node:fs"
import type { Album } from "./albums.ts"

function isAlbum(value: unknown): value is Album {
  if (typeof value !== "object" || value === null) return false
  const album = value as Record<string, unknown>
  return (
    typeof album.id === "string" &&
    album.id !== "" &&
    typeof album.title === "string" &&
    typeof album.ownerId === "string"
  )
}

export function loadAlbums(file: string): Album[] {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
  if (!Array.isArray(parsed) || !parsed.every(isAlbum)) {
    throw new Error(`Invalid album file: ${file}`)
  }
  return parsed
}
