import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { realpathSync, statSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import type { Photo, StoredPhoto } from "./photos.ts"

export type DuplicateGroup = { keeper: Photo; duplicates: Photo[] }

function isInside(root: string, target: string): boolean {
  const path = relative(root, target)
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

export function resolveUploadFile(uploadsDir: string, file: string): { path: string; realPath: string } {
  const root = realpathSync(uploadsDir)
  const candidate = resolve(root, file)
  if (!isInside(root, candidate)) throw new Error("photo file is outside uploads directory")
  const realPath = realpathSync(candidate)
  if (!isInside(root, realPath)) {
    throw new Error("photo file is outside uploads directory")
  }
  if (!statSync(realPath).isFile()) throw new Error("photo file is not a regular file")
  return { path: candidate, realPath }
}

async function hashUpload(uploadsDir: string, file: string): Promise<string> {
  const { realPath } = resolveUploadFile(uploadsDir, file)
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(realPath)) hash.update(chunk)
  return hash.digest("hex")
}

export async function findDuplicatePhotos(
  photos: StoredPhoto[],
  ownerId: string,
  uploadsDir: string,
  albumId?: string,
): Promise<DuplicateGroup[]> {
  // Scope before touching file paths so foreign or out-of-album files are never read.
  const eligible = photos.filter((photo) => photo.ownerId === ownerId && (albumId === undefined || photo.albumId === albumId))
  const seenFiles = new Set<string>()
  const byHash = new Map<string, Photo[]>()
  for (const photo of eligible) {
    if (seenFiles.has(photo.file)) continue
    seenFiles.add(photo.file)
    const hash = await hashUpload(uploadsDir, photo.file)
    const group = byHash.get(hash)
    const { ownerId: _ownerId, file: _file, ...publicPhoto } = photo
    if (group) group.push(publicPhoto)
    else byHash.set(hash, [publicPhoto])
  }

  return [...byHash.values()]
    .filter((group) => group.length > 1)
    .map(([keeper, ...duplicates]) => ({ keeper, duplicates }))
}
