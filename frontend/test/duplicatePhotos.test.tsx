import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import type { DuplicateGroup, Photo } from "../src/app/api.ts"
import { DuplicatePhotos } from "../src/app/DuplicatePhotos.tsx"
import { resolveCollage } from "../src/app/collageStore.ts"

const keeper: Photo = {
  id: "keeper",
  src: "/keeper.jpg",
  thumbnail: "/keeper-thumb.jpg",
  title: "Original",
  description: "",
  date: "2026-11-13",
  albumId: "album",
  tags: [],
}
const duplicate: Photo = { ...keeper, id: "copy", src: "/copy.jpg", thumbnail: "/copy-thumb.jpg", title: "Copy" }
const duplicateTwo: Photo = { ...keeper, id: "copy-two", src: "/copy-two.jpg", thumbnail: "/copy-two-thumb.jpg", title: "Copy two" }
const group: DuplicateGroup = { keeper, duplicates: [duplicate, duplicateTwo] }

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: "",
  json: async () => body,
}) as Response

test("scan, keep a copy, and confirm bulk removal while refreshing the current view", async () => {
  let scans = 0
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(_input)
    if (url.includes("/duplicates/delete")) return response(null, 204)
    if (url.includes("/duplicates") && init?.method === "DELETE") return response(null, 204)
    if (url.includes("/duplicates")) return response(scans++ === 0 ? [group] : [])
    return response([])
  })
  vi.stubGlobal("fetch", fetchMock)
  const onPhotosChanged = vi.fn()
  try {
    render(<DuplicatePhotos albumId="album" onPhotosChanged={onPhotosChanged} />)
    fireEvent.click(screen.getByRole("button", { name: "Find duplicate photos" }))
    expect(await screen.findByText("Copy")).toBeTruthy()
    const fullSize = screen.getByRole("link", { name: "View full-size original Original" })
    expect(fullSize.getAttribute("href")).toBe("/keeper.jpg")
    expect(fullSize.getAttribute("target")).toBe("_blank")
    expect(fullSize.getAttribute("rel")).toBe("noreferrer")
    expect(screen.getByText(/Exact duplicates are byte-identical files/)).toBeTruthy()
    const fullSizeDuplicate = screen.getByRole("link", { name: "View full-size Copy" })
    expect(fullSizeDuplicate.getAttribute("href")).toBe("/copy.jpg")
    expect(screen.getByText(/Removing a copy here only detaches it from this album/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole("button", { name: "Keep this copy" })[0])
    fireEvent.click(screen.getByRole("button", { name: "Delete all extras (1)" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete all extras" }))

    await waitFor(() => expect(screen.getByText("No exact duplicate photos found.")).toBeTruthy())
    const bulkCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/duplicates/delete"))
    expect(bulkCall?.[1]?.method).toBe("POST")
    expect(JSON.parse(String(bulkCall?.[1]?.body))).toEqual({ albumId: "album", photoIds: ["copy-two"] })
    expect(onPhotosChanged).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})

test("bulk and confirmation actions are disabled during scans and mutations", async () => {
  let resolveRescan: ((value: Response) => void) | undefined
  let resolveDelete: ((value: Response) => void) | undefined
  let scans = 0
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
    const url = String(_input)
    if (url.includes("/duplicates/delete")) {
      return new Promise<Response>((resolve) => { resolveDelete = resolve })
    }
    scans += 1
    if (scans === 1) return response([group])
    if (scans === 2) return new Promise<Response>((resolve) => { resolveRescan = resolve })
    return response([])
  })
  vi.stubGlobal("fetch", fetchMock)
  try {
    render(<DuplicatePhotos />)
    fireEvent.click(screen.getByRole("button", { name: "Find duplicate photos" }))
    await screen.findByText("Copy")

    fireEvent.click(screen.getByRole("button", { name: "Rescan duplicates" }))
    await screen.findByRole("button", { name: "Finding duplicates…" })
    expect((screen.getByRole("button", { name: "Delete all extras (2)" }) as HTMLButtonElement).disabled).toBe(true)
    resolveRescan?.(response([group]))
    await screen.findByRole("button", { name: "Rescan duplicates" })

    fireEvent.click(screen.getByRole("button", { name: "Delete all extras (2)" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete all extras" }))
    expect((screen.getByRole("button", { name: "Confirm delete all extras" }) as HTMLButtonElement).disabled).toBe(true)
    resolveDelete?.(response(null, 204))
    await screen.findByText("No exact duplicate photos found.")
  } finally {
    vi.unstubAllGlobals()
  }
})

test("individual gallery deletion uses library scope and refreshes photos", async () => {
  let scans = 0
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") return response(null, 204)
    return response(scans++ === 0 ? [group] : [])
  })
  vi.stubGlobal("fetch", fetchMock)
  const onPhotosChanged = vi.fn()
  try {
    render(<DuplicatePhotos onPhotosChanged={onPhotosChanged} />)
    fireEvent.click(screen.getByRole("button", { name: "Find duplicate photos" }))
    fireEvent.click((await screen.findAllByRole("button", { name: "Delete duplicate" }))[0])
    await waitFor(() => expect(screen.getByText("No exact duplicate photos found.")).toBeTruthy())
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")
    expect(String(deleteCall?.[0])).toContain("/api/photos/duplicates/copy")
    expect(String(deleteCall?.[0])).not.toContain("albumId")
    expect(onPhotosChanged).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})

test("failed scans offer a retry", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response({ error: "file could not be read" }, 500))
    .mockResolvedValueOnce(response([]))
  vi.stubGlobal("fetch", fetchMock)
  try {
    render(<DuplicatePhotos />)
    fireEvent.click(screen.getByRole("button", { name: "Find duplicate photos" }))
    expect((await screen.findByRole("alert")).textContent).toContain("file could not be read")
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("No exact duplicate photos found.")).toBeTruthy()
  } finally {
    vi.unstubAllGlobals()
  }
})

test("missing photos in a saved collage resolve to empty slots", () => {
  const templateId = "two-over-one"
  const saved = {
    id: "saved",
    albumId: "album",
    name: "Keepsake",
    templateId,
    photoIds: ["deleted", keeper.id, "also-deleted"],
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
  }
  const resolved = resolveCollage(saved, [keeper])
  expect(resolved.template?.id).toBe(templateId)
  expect(resolved.slots).toEqual([undefined, keeper, undefined])
  expect(resolved.missing).toBe(2)
})
