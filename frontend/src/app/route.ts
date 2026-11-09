export function albumIdFromHash(hash: string): string | null {
  const match = hash.match(/^#\/albums\/([^/]+)$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export type Page = "albums" | "upload" | "photos"

// "#/" (and anything unknown) is the Albums page, which stays the home page.
export function pageFromHash(hash: string): Page {
  if (hash === "#/upload") return "upload"
  if (hash === "#/photos") return "photos"
  return "albums"
}
