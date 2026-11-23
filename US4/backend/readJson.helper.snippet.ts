/* Add inside server/src/http.ts; readBody already exists in the base project. */
  })
}


async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const body = await readBody(req, 64 * 1024)
  if (!body) return null
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body))
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null
  } catch {
    return null
