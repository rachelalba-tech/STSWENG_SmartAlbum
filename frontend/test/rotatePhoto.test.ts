import { afterEach, expect, test, vi } from "vitest"
import { rotateImageBlob, saveRotatedPhoto } from "../src/app/api.ts"
import type { Photo } from "../src/app/api.ts"

const samplePhoto: Photo = {
  id: "p1",
  src: "/api/uploads/p1.jpg",
  thumbnail: "/api/uploads/p1.jpg",
  title: "Sunset",
  description: "",
  date: "2026-11-23",
  albumId: "a1",
  tags: [],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mockCanvas(width: number, height: number) {
  const ctx = {
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
  }
  const close = vi.fn()
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width, height, close }))
  const realCreate = document.createElement.bind(document)
  let createdCanvas: HTMLCanvasElement | null = null
  let encodedMime: string | undefined
  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    const el = realCreate(tagName)
    if (tagName === "canvas") {
      createdCanvas = el as HTMLCanvasElement
      vi.spyOn(createdCanvas, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
      vi.spyOn(createdCanvas, "toBlob").mockImplementation((cb, mime) => {
        encodedMime = mime
        cb(new Blob([new Uint8Array([1, 2, 3])], { type: mime ?? "image/png" }))
      })
    }
    return el
  }) as typeof document.createElement)
  return { ctx, close, getCanvas: () => createdCanvas!, getEncodedMime: () => encodedMime }
}

test("rotateImageBlob swaps dimensions for 90 and 270 degrees and falls back to PNG for GIF", async () => {
  const { ctx, close, getCanvas, getEncodedMime } = mockCanvas(400, 200)
  const rotated = await rotateImageBlob(new Blob(["gif"], { type: "image/gif" }), 90)

  expect(getCanvas().width).toBe(200)
  expect(getCanvas().height).toBe(400)
  expect(ctx.translate).toHaveBeenCalledWith(100, 200)
  expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2)
  expect(ctx.drawImage).toHaveBeenCalled()
  expect(close).toHaveBeenCalledOnce()
  expect(getEncodedMime()).toBe("image/png")
  expect(rotated.type).toBe("image/png")
})

test("saveRotatedPhoto uploads rotated bytes with credentials and returns updated photo", async () => {
  mockCanvas(300, 150)
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(new Uint8Array([9, 8, 7]), { status: 200, headers: { "content-type": "image/jpeg" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ...samplePhoto,
      src: "/api/uploads/rotated.jpg",
      thumbnail: "/api/uploads/rotated.jpg",
    }), { status: 200, headers: { "content-type": "application/json" } }))
  vi.stubGlobal("fetch", fetchMock)

  const updated = await saveRotatedPhoto(samplePhoto, 270)
  expect(updated.src).toContain("/api/uploads/rotated.jpg")
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[0][1]?.credentials).toBe("include")
  expect(fetchMock.mock.calls[1][0]).toContain("/api/photos/p1/image")
  expect(fetchMock.mock.calls[1][1]?.method).toBe("PUT")
  expect(fetchMock.mock.calls[1][1]?.credentials).toBe("include")
  expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>)["content-type"]).toBe("image/jpeg")
})

test("saveRotatedPhoto surfaces size-limit errors clearly", async () => {
  mockCanvas(300, 150)
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(new Uint8Array([9, 8, 7]), { status: 200, headers: { "content-type": "image/png" } }))
    .mockResolvedValueOnce(new Response("{}", { status: 413 }))
  vi.stubGlobal("fetch", fetchMock)

  await expect(saveRotatedPhoto(samplePhoto, 90)).rejects.toThrow("10 MB limit")
})
