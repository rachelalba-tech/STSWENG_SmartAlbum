import { API_URL } from "./api.ts"
import { isSavedCollage } from "./collageStore"
import type { CollageDraft, SavedCollage } from "./collageStore"

const BASE = `${API_URL}/api/collages`

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
  })
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`
    try {
      const body: unknown = await res.json()
      if (typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string") {
        message = (body as { error: string }).error
      }
    } catch {
      // not JSON: keep the status text
    }
    throw new ApiError(res.status, message)
  }
  return res
}

async function readCollage(res: Response): Promise<SavedCollage> {
  const body: unknown = await res.json()
  if (!isSavedCollage(body)) throw new ApiError(res.status, "Unexpected response from the server")
  return body
}

export async function listCollages(signal?: AbortSignal): Promise<SavedCollage[]> {
  const res = await request(BASE, { signal })
  const body: unknown = await res.json()
  if (!Array.isArray(body)) throw new ApiError(res.status, "Unexpected response from the server")
  return body.filter(isSavedCollage)
}

const payload = ({ albumId, name, templateId, photoIds }: CollageDraft) =>
  JSON.stringify({ albumId, name, templateId, photoIds })

export async function createCollage(draft: CollageDraft): Promise<SavedCollage> {
  return readCollage(await request(BASE, { method: "POST", body: payload(draft) }))
}

export async function updateCollage(id: string, draft: CollageDraft): Promise<SavedCollage> {
  return readCollage(await request(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body: payload(draft) }))
}

export async function deleteCollage(id: string): Promise<void> {
  try {
    await request(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return
    throw err
  }
}