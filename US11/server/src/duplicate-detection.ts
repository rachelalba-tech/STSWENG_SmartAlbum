import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type DuplicateCandidate = { id: string; file: string }
export type DuplicateGroup<T extends DuplicateCandidate> = T[]

/** Groups byte-identical photos by SHA-256. It never groups visually similar images. */
export async function findExactDuplicateGroups<T extends DuplicateCandidate>(
  photos: T[], uploadsDir: string,
): Promise<DuplicateGroup<T>[]> {
  const byHash = new Map<string, T[]>()
  const seenFiles = new Set<string>()
  for (const photo of photos) {
    if (seenFiles.has(photo.file)) continue
    seenFiles.add(photo.file)
    const bytes = await readFile(join(uploadsDir, photo.file))
    const hash = createHash('sha256').update(bytes).digest('hex')
    const group = byHash.get(hash) ?? []
    group.push(photo)
    byHash.set(hash, group)
  }
  return [...byHash.values()].filter(group => group.length > 1)
}

/** The first item in each group is the suggested keeper; all later items are redundant copies. */
export function redundantDuplicateIds(groups: DuplicateGroup<{id:string}>[]): string[] {
  return groups.flatMap(group => group.slice(1).map(photo => photo.id))
}
