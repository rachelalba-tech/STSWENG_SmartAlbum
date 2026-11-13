import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { fetchPhotos, type Album, type Photo } from "../src/app/api.ts"
import { PhotoGallery } from "../src/app/PhotoGallery.tsx"
import { scoreImagePixels } from "../src/app/photoQuality.ts"

function pixels(width: number, height: number, valueAt: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const value = valueAt(x, y)
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }
  }
  return data
}

const photos: Photo[] = [{
  id: "sharp-photo",
  src: "/api/uploads/sharp.jpg",
  thumbnail: "/api/uploads/sharp.jpg",
  title: "Best shot",
  description: "",
  date: "2026-11-13",
  albumId: "source",
  tags: [],
}]
const albums: Album[] = [{ id: "target", title: "Selected event", ownerId: "demo-user" }]

function stubImageAnalysis() {
  let failNextLoad = false
  let activeLoads = 0
  let maxConcurrentLoads = 0
  class FakeImage {
    crossOrigin: string | null = null
    naturalWidth = 2400
    naturalHeight = 1600
    onload: ((event: Event) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    set src(_value: string) {
      activeLoads += 1
      maxConcurrentLoads = Math.max(maxConcurrentLoads, activeLoads)
      Promise.resolve().then(() => {
        activeLoads -= 1
        if (failNextLoad) {
          failNextLoad = false
          this.onerror?.(new Event("error"))
        } else {
          this.onload?.(new Event("load"))
        }
      })
    }
  }
  vi.stubGlobal("Image", FakeImage)
  const context = {
    drawImage: vi.fn(),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: pixels(width, height, (x, y) => ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? 144 : 112)),
    }),
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D)
  return { failNext: () => { failNextLoad = true }, maxConcurrentLoads: () => maxConcurrentLoads }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test("ranks sharp image detail and rejects blurry, dark, and clipped synthetic photos", () => {
  const score = (data: Uint8ClampedArray) => scoreImagePixels(64, 64, data, 2400, 1600)
  const sharp = score(pixels(64, 64, (x, y) => ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? 144 : 112)))
  const flatBlur = score(pixels(64, 64, () => 128))
  const dark = score(pixels(64, 64, (x, y) => ((x + y) % 2 ? 18 : 8)))
  const overexposed = score(pixels(64, 64, (x, y) => ((x + y) % 2 ? 250 : 235)))
  const smallSharp = scoreImagePixels(64, 64, pixels(64, 64, (x, y) =>
    ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? 144 : 112)), 128, 96)

  expect(sharp.recommended).toBe(true)
  expect(sharp.sharpness).toBeGreaterThan(flatBlur.sharpness)
  expect(flatBlur.recommended).toBe(false)
  expect(dark.exposure).toBeLessThan(0.55)
  expect(overexposed.exposure).toBeLessThan(0.55)
  expect(dark.recommended).toBe(false)
  expect(overexposed.recommended).toBe(false)
  expect(smallSharp.sharpness).toBeGreaterThan(0.5)
  expect(smallSharp.recommended).toBe(false)
})

test("resolves API-relative image paths against the configured backend origin", async () => {
  const request = vi.fn().mockResolvedValue({ ok: true, json: async () => photos })
  vi.stubGlobal("fetch", request)

  const loaded = await fetchPhotos()
  const backend = new URL(request.mock.calls[0][0]).origin
  expect(new URL(loaded[0].src).origin).toBe(backend)
  expect(new URL(loaded[0].src).pathname).toBe("/api/uploads/sharp.jpg")
  expect(loaded[0].thumbnail).toBe(loaded[0].src)
})

test("does not treat a mostly flat background as blur when the subject has sharp detail", () => {
  const quality = scoreImagePixels(64, 64, pixels(64, 64, (x, y) =>
    x < 24 && y < 24 ? ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? 144 : 112) : 128), 2400, 1600)

  expect(quality.sharpness).toBeGreaterThan(0.5)
  expect(quality.recommended).toBe(true)
})

test("surfaces image decode errors and lets the user retry a quality check", async () => {
  const image = stubImageAnalysis()
  image.failNext()
  render(<PhotoGallery photos={photos} albums={albums} />)

  fireEvent.click(screen.getByRole("button", { name: "Recommend best photos" }))
  expect(await screen.findByText(/Could not assess 1 photo/)).toBeTruthy()
  expect(screen.getByText(/No confident recommendations/)).toBeTruthy()
  expect(screen.getByText(/Image could not be loaded/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(await screen.findByRole("button", { name: "Add to album" })).toBeTruthy()
})

test("limits simultaneous image decodes when recommending from a large library", async () => {
  const image = stubImageAnalysis()
  const manyPhotos = Array.from({ length: 32 }, (_, index) => ({
    ...photos[0],
    id: `photo-${index}`,
    title: `Photo ${index}`,
  }))
  render(<PhotoGallery photos={manyPhotos} albums={albums} />)

  fireEvent.click(screen.getByRole("button", { name: "Recommend best photos" }))
  expect(await screen.findAllByRole("button", { name: "Add to album" })).toHaveLength(32)
  expect(image.maxConcurrentLoads()).toBe(1)
})

test("adds a recommendation to an existing album and keeps add failures retryable", async () => {
  stubImageAnalysis()
  const responsePhoto = { ...photos[0], id: "target-copy", albumId: "target" }
  const request = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: "storage unavailable" }), { status: 500 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([responsePhoto]), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))
  vi.stubGlobal("fetch", request)
  render(<PhotoGallery photos={photos} albums={albums} />)

  fireEvent.click(screen.getByRole("button", { name: "Recommend best photos" }))
  const add = await screen.findByRole("button", { name: "Add to album" })
  fireEvent.change(screen.getByLabelText("Add recommended photos to"), { target: { value: "target" } })
  fireEvent.click(add)
  expect(await screen.findByRole("alert")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Add to album" }))
  expect(await screen.findByText("Added Best shot to Selected event.")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Added" })).toBeTruthy()
  expect(request).toHaveBeenCalledTimes(2)
  expect(request.mock.calls[1][1]).toMatchObject({
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ photoIds: ["sharp-photo"] }),
  })
})
