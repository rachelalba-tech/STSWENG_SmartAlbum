import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import type { Photo } from "../src/app/api.ts"
import {
  compareFingerprints,
  extractImageFingerprint,
  groupSimilarPhotos,
} from "../src/app/photoSimilarity.ts"
import { SimilarPhotos } from "../src/app/SimilarPhotos.tsx"

function makeRgbPixels(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => [number, number, number],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colorAt(x, y)
      const offset = (y * width + x) * 4
      data[offset] = Math.max(0, Math.min(255, Math.round(r)))
      data[offset + 1] = Math.max(0, Math.min(255, Math.round(g)))
      data[offset + 2] = Math.max(0, Math.min(255, Math.round(b)))
      data[offset + 3] = 255
    }
  }
  return data
}

const sunsetShotA = (width: number, height: number) =>
  makeRgbPixels(width, height, (x, y) => {
    const sky = y < height * 0.55
    const texture = ((Math.floor(x / 2) + Math.floor(y / 2)) % 2) * 14
    return sky
      ? [215 - (x / width) * 60 + texture, 125 + (y / height) * 40, 70]
      : [45 + (x / width) * 35 + texture, 55, 75]
  })

const sunsetShotB = (width: number, height: number) =>
  makeRgbPixels(width, height, (x, y) => {
    // Slightly shifted and slightly brighter burst shot of the same sunset scene.
    const shiftedX = Math.max(0, x - 1)
    const sky = y < height * 0.57
    return sky
      ? [222 - (shiftedX / width) * 60, 130 + (y / height) * 40, 74]
      : [49 + (shiftedX / width) * 35, 58, 79]
  })

const forestShotA = (width: number, height: number) =>
  makeRgbPixels(width, height, (x, y) => {
    const trunk = x > width * 0.35 && x < width * 0.65
    const detail = ((Math.floor(x / 2) + Math.floor(y / 2)) % 2) * 18
    return trunk
      ? [70 + detail, 145 + (y / height) * 45, 65]
      : [35, 110 + (x / width) * 50 + detail, 50]
  })

const forestShotB = (width: number, height: number) =>
  makeRgbPixels(width, height, (x, y) => {
    const trunk = x > width * 0.34 && x < width * 0.64
    return trunk
      ? [74, 148 + (y / height) * 45, 68]
      : [38, 113 + (x / width) * 50, 52]
  })

const nightPortrait = (width: number, height: number) =>
  makeRgbPixels(width, height, (x, y) => {
    const center = Math.hypot(x - width / 2, y - height / 2) < width * 0.25
    return center ? [190, 175, 220] : [18, 22, 42]
  })

function makePhoto(id: string, title: string, albumId = "album-1"): Photo {
  return {
    id,
    src: `/api/uploads/${id}.jpg`,
    thumbnail: `/api/uploads/${id}.jpg`,
    title,
    description: "",
    date: "2026-11-26",
    albumId,
    tags: [],
  }
}

function stubSimilarityCanvas(bySrc: Record<string, (w: number, h: number) => Uint8ClampedArray>, failOnceSrc?: string) {
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
      const factory = bySrc[lastSrc]
      if (!factory) throw new Error(`Missing test image pixels for ${lastSrc}`)
      return { data: factory(width, height) }
    },
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D)
  return { maxConcurrentLoads: () => maxConcurrentLoads }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test("groups visually similar burst shots, separates distinct scenes, and ranks sharper shot first", () => {
  const fpSunsetA = extractImageFingerprint(64, 64, sunsetShotA(64, 64), 1920, 1080)
  const fpSunsetB = extractImageFingerprint(64, 64, sunsetShotB(64, 64), 960, 540)
  const fpForestA = extractImageFingerprint(64, 64, forestShotA(64, 64), 1920, 1080)
  const fpNight = extractImageFingerprint(64, 64, nightPortrait(64, 64), 1920, 1080)

  expect(compareFingerprints(fpSunsetA, fpSunsetB).similar).toBe(true)
  expect(compareFingerprints(fpSunsetA, fpForestA).similar).toBe(false)
  expect(compareFingerprints(fpSunsetA, fpNight).similar).toBe(false)
  expect(compareFingerprints(fpForestA, fpNight).similar).toBe(false)

  const photoA = makePhoto("sunset-a", "Sunset sharp")
  const photoB = makePhoto("sunset-b", "Sunset soft")
  const sharedMembership = { ...photoA, id: "sunset-a-copy" }
  const photoForest = makePhoto("forest", "Forest")
  const photoNight = makePhoto("night", "Night")

  const groups = groupSimilarPhotos([
    { photo: photoB, fingerprint: fpSunsetB },
    { photo: photoA, fingerprint: fpSunsetA },
    { photo: sharedMembership, fingerprint: fpSunsetA },
    { photo: photoForest, fingerprint: fpForestA },
    { photo: photoNight, fingerprint: fpNight },
  ])

  expect(groups).toHaveLength(1)
  expect(groups[0].photos.map((item) => item.photo.id)).toEqual(["sunset-a", "sunset-b"])
  expect(groups[0].similarity).toBeGreaterThanOrEqual(78)
})

test("scans sequentially, lets the user review sets one by one, keep a photo, and detach from album", async () => {
  const s1 = makePhoto("s1", "Sunset 1")
  const s2 = makePhoto("s2", "Sunset 2")
  const f1 = makePhoto("f1", "Forest 1")
  const f2 = makePhoto("f2", "Forest 2")
  const solo = makePhoto("solo", "Night solo")

  const stub = stubSimilarityCanvas({
    [s1.src]: sunsetShotA,
    [s2.src]: sunsetShotB,
    [f1.src]: forestShotA,
    [f2.src]: forestShotB,
    [solo.src]: nightPortrait,
  })

  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetchMock)
  const onPhotosChanged = vi.fn()

  render(<SimilarPhotos albumId="album-1" photos={[s1, s2, f1, f2, solo]} onPhotosChanged={onPhotosChanged} />)
  fireEvent.click(screen.getByRole("button", { name: "Find similar photos" }))

  expect(await screen.findByText("Set 1 of 2")).toBeTruthy()
  expect(stub.maxConcurrentLoads()).toBe(1)
  expect(screen.queryByText(/Quality \d+\/100/)).toBeNull()

  // Step to the second set individually.
  fireEvent.click(screen.getByRole("button", { name: "Next set" }))
  expect(screen.getByText("Set 2 of 2")).toBeTruthy()

  // Keep the first photo in the active set and remove the second from the album.
  fireEvent.click(screen.getAllByRole("button", { name: "Keep photo" })[0])
  expect(screen.getByText("Kept")).toBeTruthy()

  const removeButtons = screen.getAllByRole("button", { name: "Remove from album" })
  expect(removeButtons).toHaveLength(1)
  fireEvent.click(removeButtons[0])

  await waitFor(() => expect(onPhotosChanged).toHaveBeenCalledOnce())
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/albums\/album-1\/photos\/(s2|f2)$/),
    expect.objectContaining({ method: "DELETE", credentials: "include" }),
  )
  // After removing one photo from a 2-photo set, only 1 similar set remains.
  expect(screen.queryByText("Set 2 of 2")).toBeNull()
})

test("gallery deletion removes a similar photo from the library and drops its set", async () => {
  const s1 = makePhoto("s1", "Sunset 1", "")
  const s2 = makePhoto("s2", "Sunset 2", "")

  stubSimilarityCanvas({
    [s1.src]: sunsetShotA,
    [s2.src]: sunsetShotB,
  })

  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetchMock)
  const onPhotosChanged = vi.fn()

  render(<SimilarPhotos photos={[s1, s2]} onPhotosChanged={onPhotosChanged} />)
  fireEvent.click(screen.getByRole("button", { name: "Find similar photos" }))

  const deleteButtons = await screen.findAllByRole("button", { name: "Delete photo" })
  expect(deleteButtons).toHaveLength(2)
  fireEvent.click(deleteButtons[1])

  await waitFor(() => expect(screen.getByText("No visually similar photos found.")).toBeTruthy())
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/photos/s2",
    expect.objectContaining({ method: "DELETE", credentials: "include" }),
  )
  expect(onPhotosChanged).toHaveBeenCalledOnce()
})

test("surfaces decode errors and retries comparing the failed photo", async () => {
  const s1 = makePhoto("s1", "Sunset 1")
  const s2 = makePhoto("s2", "Sunset 2")

  stubSimilarityCanvas(
    {
      [s1.src]: sunsetShotA,
      [s2.src]: sunsetShotB,
    },
    s2.src,
  )

  render(<SimilarPhotos photos={[s1, s2]} />)
  fireEvent.click(screen.getByRole("button", { name: "Find similar photos" }))

  expect(await screen.findByText(/Could not compare 1 photo/)).toBeTruthy()
  expect(screen.getByText("No visually similar photos found.")).toBeTruthy()

  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(await screen.findByText("Similar set 1")).toBeTruthy()
  expect(screen.queryByText(/Could not compare/)).toBeNull()
})

test("invalidates cached similarity fingerprint when a photo src changes after rotation", async () => {
  const s1 = makePhoto("s1", "Sunset 1")
  const s2 = makePhoto("s2", "Sunset 2")
  const s2Rotated = { ...s2, src: "/api/uploads/s2-rotated.jpg", thumbnail: "/api/uploads/s2-rotated.jpg" }

  stubSimilarityCanvas({
    [s1.src]: sunsetShotA,
    [s2.src]: sunsetShotB,
    [s2Rotated.src]: nightPortrait,
  })

  const { rerender } = render(<SimilarPhotos photos={[s1, s2]} />)
  fireEvent.click(screen.getByRole("button", { name: "Find similar photos" }))
  expect(await screen.findByText("Similar set 1")).toBeTruthy()

  // Rotating s2 replaces its src; stale fingerprint must not keep it grouped.
  rerender(<SimilarPhotos photos={[s1, s2Rotated]} />)
  expect(screen.getByText("No visually similar photos found.")).toBeTruthy()
})
