import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import type { Photo } from "../src/app/api.ts"
import { LowQualityPhotos } from "../src/app/LowQualityPhotos.tsx"
import { getLowQualityReasons, scoreImagePixels } from "../src/app/photoQuality.ts"

function grayPixels(width: number, height: number, valueAt: (x: number, y: number) => number) {
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

const sharpPixels = (w: number, h: number) =>
  grayPixels(w, h, (x, y) => ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? 144 : 112))
const blurryPixels = (w: number, h: number) => grayPixels(w, h, () => 128)
const darkPixels = (w: number, h: number) => grayPixels(w, h, (x, y) => ((x + y) % 2 ? 18 : 8))
const backlitPixels = (w: number, h: number) => grayPixels(w, h, (x, y) => ((x + y) % 2 ? 250 : 235))

function makePhoto(id: string, title: string, albumId = "album-1"): Photo {
  return {
    id,
    src: `/api/uploads/${id}.jpg`,
    thumbnail: `/api/uploads/${id}.jpg`,
    title,
    description: "",
    date: "2026-11-27",
    albumId,
    tags: [],
  }
}

type SyntheticImage = {
  width: number
  height: number
  pixels: (w: number, h: number) => Uint8ClampedArray
}

function stubQualityCanvas(bySrc: Record<string, SyntheticImage>, failOnceSrc?: string) {
  let remainingFailure = failOnceSrc ?? null
  let activeLoads = 0
  let maxConcurrentLoads = 0

  class FakeImage {
    crossOrigin: string | null = null
    naturalWidth = 1920
    naturalHeight = 1080
    onload: ((event: Event) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    private currentSrc = ""

    get src() {
      return this.currentSrc
    }

    set src(value: string) {
      this.currentSrc = value
      const spec = bySrc[value]
      if (spec) {
        this.naturalWidth = spec.width
        this.naturalHeight = spec.height
      }
      activeLoads += 1
      maxConcurrentLoads = Math.max(maxConcurrentLoads, activeLoads)
      Promise.resolve().then(() => {
        activeLoads -= 1
        if (remainingFailure && value === remainingFailure) {
          remainingFailure = null
          this.onerror?.(new Event("error"))
        } else {
          this.onload?.(new Event("load"))
        }
      })
    }
  }

  vi.stubGlobal("Image", FakeImage)
  let lastSrc = ""
  const context = {
    drawImage: vi.fn((image: FakeImage) => {
      lastSrc = image.src
    }),
    getImageData: (_x: number, _y: number, width: number, height: number) => {
      const spec = bySrc[lastSrc]
      if (!spec) throw new Error(`Missing test image pixels for ${lastSrc}`)
      return { data: spec.pixels(width, height) }
    },
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D)
  return { maxConcurrentLoads: () => maxConcurrentLoads }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test("identifies specific low-quality reasons for blurry, dark, backlit, and low-resolution photos", () => {
  const sharp = scoreImagePixels(64, 64, sharpPixels(64, 64), 2400, 1600)
  const blurry = scoreImagePixels(64, 64, blurryPixels(64, 64), 2400, 1600)
  const dark = scoreImagePixels(64, 64, darkPixels(64, 64), 2400, 1600)
  const backlit = scoreImagePixels(64, 64, backlitPixels(64, 64), 2400, 1600)
  const tiny = scoreImagePixels(64, 64, sharpPixels(64, 64), 128, 96)

  expect(getLowQualityReasons(sharp)).toEqual([])
  expect(getLowQualityReasons(blurry)).toContain("Blurry")
  expect(getLowQualityReasons(dark)).toContain("Too dark")
  expect(getLowQualityReasons(backlit)).toContain("Overexposed / backlit")
  expect(getLowQualityReasons(tiny)).toContain("Low resolution")
})

test("scans sequentially, flags low-quality photos, supports one-by-one review, keep, and album removal", async () => {
  const sharp = makePhoto("sharp", "Clear portrait")
  const blurry = makePhoto("blurry", "Blurry street")
  const dark = makePhoto("dark", "Dark room")

  const stub = stubQualityCanvas({
    [sharp.src]: { width: 2400, height: 1600, pixels: sharpPixels },
    [blurry.src]: { width: 2400, height: 1600, pixels: blurryPixels },
    [dark.src]: { width: 2400, height: 1600, pixels: darkPixels },
  })

  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetchMock)
  const onPhotosChanged = vi.fn()

  render(<LowQualityPhotos albumId="album-1" photos={[sharp, blurry, dark]} onPhotosChanged={onPhotosChanged} />)
  fireEvent.click(screen.getByRole("button", { name: "Find low quality photos" }))

  expect(await screen.findByText("2 photos flagged")).toBeTruthy()
  expect(stub.maxConcurrentLoads()).toBe(1)
  expect(screen.queryByText("Clear portrait")).toBeNull()
  expect(screen.getByText("Blurry street")).toBeTruthy()
  expect(screen.getByText("Dark room")).toBeTruthy()
  expect(screen.getByText("Blurry")).toBeTruthy()
  expect(screen.getByText("Too dark")).toBeTruthy()

  // Switch to one-at-a-time review and step through flagged photos.
  fireEvent.click(screen.getByRole("button", { name: "Review one at a time" }))
  expect(screen.getByText("Photo 1 of 2")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Next photo" }))
  expect(screen.getByText("Photo 2 of 2")).toBeTruthy()

  // Keep the active photo, then step back and remove the other from the album.
  fireEvent.click(screen.getByRole("button", { name: "Keep photo" }))
  expect(screen.getByText("Kept")).toBeTruthy()

  fireEvent.click(screen.getByRole("button", { name: "Previous photo" }))
  fireEvent.click(screen.getByRole("button", { name: "Remove from album" }))

  await waitFor(() => expect(onPhotosChanged).toHaveBeenCalledOnce())
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/albums\/album-1\/photos\/(blurry|dark)$/),
    expect.objectContaining({ method: "DELETE", credentials: "include" }),
  )
  expect(screen.getByText("1 photo flagged")).toBeTruthy()
})

test("gallery bulk delete removes all unkept flagged photos from library after confirmation", async () => {
  const blurry = makePhoto("blurry", "Blurry shot", "")
  const backlit = makePhoto("backlit", "Backlit shot", "")
  const tiny = makePhoto("tiny", "Tiny thumbnail", "")

  stubQualityCanvas({
    [blurry.src]: { width: 2400, height: 1600, pixels: blurryPixels },
    [backlit.src]: { width: 2400, height: 1600, pixels: backlitPixels },
    [tiny.src]: { width: 128, height: 96, pixels: sharpPixels },
  })

  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetchMock)
  const onPhotosChanged = vi.fn()

  render(<LowQualityPhotos photos={[blurry, backlit, tiny]} onPhotosChanged={onPhotosChanged} />)
  fireEvent.click(screen.getByRole("button", { name: "Find low quality photos" }))

  expect(await screen.findByText("3 photos flagged")).toBeTruthy()

  // Keep the first flagged photo so only 2 are pending bulk deletion.
  fireEvent.click(screen.getAllByRole("button", { name: "Keep photo" })[0])
  fireEvent.click(screen.getByRole("button", { name: "Delete all flagged (2)" }))
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete all flagged" }))

  await waitFor(() => expect(onPhotosChanged).toHaveBeenCalledOnce())
  expect(fetchMock).toHaveBeenCalledTimes(2)
  for (const call of fetchMock.mock.calls) {
    expect(call[0]).toMatch(/^\/api\/photos\//)
    expect(call[1]).toMatchObject({ method: "DELETE", credentials: "include" })
  }
  expect(screen.getByText("1 photo flagged")).toBeTruthy()
})

test("surfaces decode errors, retries failed photo, and invalidates cache when src changes", async () => {
  const blurry = makePhoto("blurry", "Blurry shot")
  const sharpReplacement = {
    ...blurry,
    src: "/api/uploads/blurry-fixed.jpg",
    thumbnail: "/api/uploads/blurry-fixed.jpg",
  }

  stubQualityCanvas(
    {
      [blurry.src]: { width: 2400, height: 1600, pixels: blurryPixels },
      [sharpReplacement.src]: { width: 2400, height: 1600, pixels: sharpPixels },
    },
    blurry.src,
  )

  const { rerender } = render(<LowQualityPhotos photos={[blurry]} />)
  fireEvent.click(screen.getByRole("button", { name: "Find low quality photos" }))

  expect(await screen.findByText(/Could not check 1 photo/)).toBeTruthy()
  expect(screen.getByText("No low-quality photos found.")).toBeTruthy()

  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(await screen.findByText("1 photo flagged")).toBeTruthy()
  expect(screen.queryByText(/Could not check/)).toBeNull()

  // Replacing src invalidates the cached low-quality result.
  rerender(<LowQualityPhotos photos={[sharpReplacement]} />)
  expect(screen.getByText("No low-quality photos found.")).toBeTruthy()
})
