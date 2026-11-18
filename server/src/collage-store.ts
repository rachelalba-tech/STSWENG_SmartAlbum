import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import type { StoredCollage } from "./collages.ts"

function isStoredCollage(value: unknown): value is StoredCollage {
  if (typeof value !== "object" || value === null) return false
  const c = value as Record<string, unknown>
  return (
    typeof c.id === "string" &&
    c.id !== "" &&
    typeof c.albumId === "string" &&
    typeof c.name === "string" &&
    typeof c.templateId === "string" &&
    Array.isArray(c.photoIds) &&
    c.photoIds.every((id) => typeof id === "string") &&
    typeof c.createdAt === "string" &&
    typeof c.updatedAt === "string" &&
    typeof c.ownerId === "string"
  )
}

export function loadCollages(file: string): StoredCollage[] {
  if (!existsSync(file)) return []
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
  if (!Array.isArray(parsed) || !parsed.every(isStoredCollage)) {
    throw new Error(`Invalid collage file: ${file}`)
  }
  return parsed
}

export function saveCollages(file: string, collages: StoredCollage[]): void {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(collages, null, 2))
  renameSync(tmp, file)
}