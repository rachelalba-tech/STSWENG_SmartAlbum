/* server/src/http.ts — add once inside module scope. readBody already exists in the base project. */
async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const body = await readBody(req, 64 * 1024)
  if (body === null || body.length === 0) return null

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body))
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}
