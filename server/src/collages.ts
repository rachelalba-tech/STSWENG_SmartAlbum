export type Collage = {
  id: string
  albumId: string
  name: string
  templateId: string
  photoIds: string[]
  createdAt: string
  updatedAt: string
}

export type StoredCollage = Collage & { ownerId: string }

export type CollageInput = Pick<Collage, "albumId" | "name" | "templateId" | "photoIds">

export const MAX_COLLAGE_NAME = 80
export const MAX_COLLAGE_PHOTOS = 50
export const MAX_COLLAGE_BODY_BYTES = 64 * 1024

const TEMPLATE_ID = /^[A-Za-z0-9_-]{1,64}$/

export function parseCollageInput(value: unknown): { input: CollageInput } | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: "expected a JSON object" }
  }
  const body = value as Record<string, unknown>

  if (typeof body.albumId !== "string" || body.albumId === "") return { error: "albumId is required" }

  if (typeof body.name !== "string") return { error: "name is required" }
  const name = body.name.trim()
  if (name === "") return { error: "name is required" }
  if (name.length > MAX_COLLAGE_NAME) return { error: `name must be at most ${MAX_COLLAGE_NAME} characters` }

  if (typeof body.templateId !== "string" || !TEMPLATE_ID.test(body.templateId)) {
    return { error: "templateId is invalid" }
  }

  const ids = body.photoIds
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_COLLAGE_PHOTOS) {
    return { error: `photoIds must list 1 to ${MAX_COLLAGE_PHOTOS} photos` }
  }
  if (!ids.every((id) => typeof id === "string" && id !== "")) {
    return { error: "photoIds must be non-empty strings" }
  }
  if (new Set(ids).size !== ids.length) return { error: "photoIds must not repeat" }

  return { input: { albumId: body.albumId, name, templateId: body.templateId, photoIds: [...ids] as string[] } }
}

export function photosBelongToAlbum(
  photos: { id: string; ownerId: string; albumId: string }[],
  ownerId: string,
  albumId: string,
  photoIds: string[],
): boolean {
  const allowed = new Set(
    photos.filter((p) => p.ownerId === ownerId && p.albumId === albumId).map((p) => p.id),
  )
  return photoIds.every((id) => allowed.has(id))
}

export function listCollagesForUser(collages: StoredCollage[], ownerId: string, albumId?: string): Collage[] {
  return collages
    .filter((c) => c.ownerId === ownerId && (albumId === undefined || c.albumId === albumId))
    .map(toPublicCollage)
}

export function toPublicCollage({ ownerId: _ownerId, ...collage }: StoredCollage): Collage {
  return { ...collage, photoIds: [...collage.photoIds] }
}