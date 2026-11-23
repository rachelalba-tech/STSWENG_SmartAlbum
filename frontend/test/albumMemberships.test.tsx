import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import App from "../src/app/App.tsx"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
test("album cards load all memberships rather than losing shared-file copies to library dedup", async () => {
  window.location.hash = "#/"
  const albums = [{ id: "a", title: "Source", ownerId: "demo-user" }, { id: "b", title: "Target", ownerId: "demo-user" }]
  const request = vi.fn(async (url: string) => {
    if (url.endsWith("/api/session")) return new Response(JSON.stringify({ id: "demo-user", username: "test", role: "admin" }))
    if (url.endsWith("/api/albums")) return new Response(JSON.stringify(albums))
    if (url.includes("/api/photos?albumId=")) {
      const albumId = new URL(url, "http://localhost").searchParams.get("albumId")
      return new Response(JSON.stringify([{ id: "p-" + albumId, src: "/same.png", albumId, title: "Shared" }]))
    }
    return new Response("[]")
  })
  vi.stubGlobal("fetch", request)
  render(<App />)
  await waitFor(() => expect(screen.getByRole("link", { name: "Open Target" }).textContent).toContain("1 photo"))
  expect(screen.getByRole("link", { name: "Open Source" }).textContent).toContain("1 photo")
  expect(request.mock.calls.some(([url]) => url.endsWith("/api/photos"))).toBe(false)
})
