export function albumIdFromHash(hash: string): string | null {
  const match = hash.match(/^#\/albums\/([^/]+)$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}
