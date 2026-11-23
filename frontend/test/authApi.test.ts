import { afterEach, expect, test, vi } from "vitest"
import { apiFetch, fetchAlbums, login, logout } from "../src/app/api.ts"
import { listCollages } from "../src/app/collageApi.ts"

afterEach(() => vi.unstubAllGlobals())
test("album and collage APIs include session credentials; 401 notifies the application", async () => {
  const request = vi.fn().mockResolvedValue(new Response("[]"))
  vi.stubGlobal("fetch", request)
  await fetchAlbums()
  request.mockResolvedValueOnce(new Response("[]"))
  await listCollages()
  for (const [, init] of request.mock.calls) expect(init.credentials).toBe("include")
  const expired = vi.fn()
  window.addEventListener("session-expired", expired)
  try {
    request.mockResolvedValueOnce(new Response("{}", { status: 401 }))
    await apiFetch("/api/photos")
    expect(expired).toHaveBeenCalledOnce()
  } finally { window.removeEventListener("session-expired", expired) }
})
test("login validates the server role, and failed logout is not reported as success", async () => {
  const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "u", username: "u" }))).mockResolvedValueOnce(new Response(null, { status: 500 }))
  vi.stubGlobal("fetch", request)
  await expect(login("u", "password")).rejects.toThrow("unexpected response")
  await expect(logout()).rejects.toThrow("Could not log out")
})
