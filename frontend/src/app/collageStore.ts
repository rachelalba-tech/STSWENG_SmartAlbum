import type { Photo } from "./AlbumManager"
import { TEMPLATES } from "./collageTemplates"
import type { CollageTemplate } from "./collageTemplates"

export interface SavedCollage {
  id: string
  albumId: string
  name: string
  templateId: string
  photoIds: string[]
  createdAt: string 
  updatedAt: string 
}

export interface CollageDraft {
  id?: string
  albumId: string
  name: string
  templateId: string
  photoIds: string[]
}

export type CollagesStatus = "loading" | "ready" | "error"

export interface ResolvedCollage {
  template: CollageTemplate | undefined
  slots: (Photo | undefined)[]
  missing: number
}

export function resolveCollage(collage: SavedCollage, albumPhotos: Photo[]): ResolvedCollage {
  const found = TEMPLATES.find((t) => t.id === collage.templateId)
  const template = found && found.cells.length === collage.photoIds.length ? found : undefined
  const byId = new Map(albumPhotos.map((p) => [p.id, p]))
  const slots = collage.photoIds.map((id) => byId.get(id))
  return { template, slots, missing: slots.filter((s) => !s).length }
}

export const isSavedCollage = (v: unknown): v is SavedCollage => {
  if (typeof v !== "object" || v === null) return false
  const c = v as Record<string, unknown>
  return (
    typeof c.id === "string" &&
    typeof c.albumId === "string" &&
    typeof c.name === "string" &&
    typeof c.templateId === "string" &&
    typeof c.createdAt === "string" &&
    typeof c.updatedAt === "string" &&
    Array.isArray(c.photoIds) &&
    c.photoIds.every((id) => typeof id === "string")
  )
}