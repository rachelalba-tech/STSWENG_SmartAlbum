import { afterEach, expect, test, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

const response = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
}) as Response

const photo = (id: string, src: string, thumbnail: string) => ({ id, src, thumbnail, albumId: "album" })

test("photo API responses resolve only managed upload URLs against the API origin", async () => {
  vi.stubEnv("VITE_API_URL", "https://api.example.test/")
  vi.resetModules()
  const { fetchPhotos, uploadPhoto, fetchDuplicateGroups } = await import("../src/app/api.ts")
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal("fetch", fetchMock)

  const managed = photo("managed", "/api/uploads/full.jpg", "/api/uploads/thumb.jpg")
  const external = photo("external", "https://cdn.example.test/full.jpg", "https://cdn.example.test/thumb.jpg")
  const relative = photo("relative", "fixtures/full.jpg", "fixtures/thumb.jpg")

  fetchMock.mockResolvedValueOnce(response([managed, external, relative]))
  const fetched = await fetchPhotos("album")
  expect(fetched.map(({ src, thumbnail }) => [src, thumbnail])).toEqual([
    ["https://api.example.test/api/uploads/full.jpg", "https://api.example.test/api/uploads/thumb.jpg"],
    [external.src, external.thumbnail],
    [relative.src, relative.thumbnail],
  ])

  fetchMock.mockResolvedValueOnce(response(photo("uploaded", "/api/uploads/upload.jpg", "/api/uploads/upload-thumb.jpg")))
  const uploaded = await uploadPhoto("album", new File(["image"], "upload.jpg", { type: "image/jpeg" }))
  expect([uploaded.src, uploaded.thumbnail]).toEqual([
    "https://api.example.test/api/uploads/upload.jpg",
    "https://api.example.test/api/uploads/upload-thumb.jpg",
  ])

  fetchMock.mockResolvedValueOnce(response({ ...photo("library", "/api/uploads/lib.jpg", "/api/uploads/lib.jpg"), albumId: "" }))
  const libraryUploaded = await uploadPhoto("", new File(["image"], "lib.jpg", { type: "image/jpeg" }))
  expect([libraryUploaded.src, libraryUploaded.albumId]).toEqual([
    "https://api.example.test/api/uploads/lib.jpg",
    "",
  ])

  fetchMock.mockResolvedValueOnce(response([{ keeper: managed, duplicates: [external, relative] }]))
  const [group] = await fetchDuplicateGroups("album")
  expect([group.keeper.src, group.keeper.thumbnail]).toEqual([
    "https://api.example.test/api/uploads/full.jpg",
    "https://api.example.test/api/uploads/thumb.jpg",
  ])
  expect(group.duplicates.map(({ src, thumbnail }) => [src, thumbnail])).toEqual([
    [external.src, external.thumbnail],
    [relative.src, relative.thumbnail],
  ])

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "https://api.example.test/api/photos?albumId=album",
    "https://api.example.test/api/albums/album/photos",
    "https://api.example.test/api/photos",
    "https://api.example.test/api/photos/duplicates?albumId=album",
  ])
})
