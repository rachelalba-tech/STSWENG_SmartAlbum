import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import type { StoredPhoto } from "./photos.ts"

function isStoredPhoto(value: unknown): value is StoredPhoto {
  if (typeof value !== "object" || value === null) return false
  const p = value as Record<string, unknown>
  return (
    typeof p.id === "string" &&
    p.id !== "" &&
    typeof p.src === "string" &&
    typeof p.thumbnail === "string" &&
    typeof p.title === "string" &&
    typeof p.description === "string" &&
    typeof p.date === "string" &&
    typeof p.albumId === "string" &&
    (p.position === undefined || (Number.isSafeInteger(p.position) && (p.position as number) >= 0)) &&
    Array.isArray(p.tags) &&
    typeof p.ownerId === "string" &&
    typeof p.file === "string"
  )
}

export function loadPhotos(file: string): StoredPhoto[] {
  if (!existsSync(file)) return []
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
  if (!Array.isArray(parsed) || !parsed.every(isStoredPhoto)) {
    throw new Error(`Invalid photo file: ${file}`)
  }
  return parsed
}

export function savePhotos(file: string, photos: StoredPhoto[]): void {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(photos, null, 2))
  renameSync(tmp, file)
}
