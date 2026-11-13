import { afterEach, expect, test, vi } from "vitest"
import { downloadCollage, renderCollageBlob } from "../src/app/collageExport.ts"
import type { CollageTemplate } from "../src/app/collageTemplates.ts"

const template: CollageTemplate = {
  id: "test-grid",
  name: "Test grid",
  cols: 2,
  rows: 2,
  cells: [
    { col: 1, row: 1 }, { col: 2, row: 1 },
    { col: 1, row: 2 }, { col: 2, row: 2 },
  ],
}

const photos = Array.from({ length: 4 }, (_, index) => ({
  src: `https://api.example.test/api/uploads/photo-${index + 1}.jpg`,
  title: `Photo ${index + 1}`,
}))

const mockImages: MockImage[] = []
let shouldFailImage = false
let holdImageLoads = false
const pendingImageLoads: Array<() => void> = []

class MockImage {
  crossOrigin: string | null = null
  naturalWidth = 400
  naturalHeight = 200
  onload: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  private source = ""

  constructor() {
    mockImages.push(this)
  }

  set src(value: string) {
    this.source = value
    if (shouldFailImage) this.onerror?.(new Event("error"))
    else if (holdImageLoads) pendingImageLoads.push(() => this.onload?.(new Event("load")))
    else this.onload?.(new Event("load"))
  }

  get src() {
    return this.source
  }
}

afterEach(() => {
  mockImages.length = 0
  shouldFailImage = false
  holdImageLoads = false
  pendingImageLoads.length = 0
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setupStage() {
  const stage = document.createElement("div")
  Object.defineProperty(stage, "getBoundingClientRect", { configurable: true, value: () => rect(0, 0, 480, 480) })
  for (const [left, top] of [[6, 6], [243, 6], [6, 243], [243, 243]]) {
    const slot = document.createElement("div")
    slot.className = "ac-slot"
    Object.defineProperty(slot, "getBoundingClientRect", { configurable: true, value: () => rect(left, top, 231, 231) })
    stage.append(slot)
  }
  return stage
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => ({}) }
}

function setupCanvas(toBlob?: HTMLCanvasElement["toBlob"]) {
  const canvas = document.createElement("canvas")
  let fillStyle = ""
  const operations: Array<{ type: "fill" | "draw"; color?: string; rect?: number[] }> = []
  const context = {
    get fillStyle() { return fillStyle },
    set fillStyle(value: string) { fillStyle = value },
    fillRect: vi.fn((x: number, y: number, width: number, height: number) => {
      operations.push({ type: "fill", color: fillStyle, rect: [x, y, width, height] })
    }),
    drawImage: vi.fn(() => operations.push({ type: "draw" })),
  } as unknown as CanvasRenderingContext2D
  const blobCallback = vi.fn(toBlob ?? ((callback: BlobCallback, mime?: string) => callback(new Blob(["image"], { type: mime }))))
  Object.defineProperty(canvas, "getContext", { value: () => context })
  Object.defineProperty(canvas, "toBlob", { value: blobCallback })
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) =>
    tagName === "canvas" ? canvas : createElement(tagName)) as typeof document.createElement)
  vi.stubGlobal("Image", MockImage)
  return { canvas, context, blobCallback, operations }
}

test("renders a square high-resolution canvas with PNG/JPEG MIME and object-fit: cover geometry", async () => {
  const { canvas, context } = setupCanvas()
  const blob = await renderCollageBlob(template, photos, setupStage(), "jpeg")

  expect(canvas.width).toBe(2400)
  expect(canvas.height).toBe(2400)
  expect(blob.type).toBe("image/jpeg")
  expect(context.fillRect).toHaveBeenCalledWith(0, 0, 2400, 2400)
  expect(context.drawImage).toHaveBeenCalledTimes(4)
  expect(context.drawImage).toHaveBeenNthCalledWith(
    1,
    mockImages[0],
    100, 0, 200, 200,
    30, 30, 1155, 1155,
  )
  expect(mockImages.every((image) => image.crossOrigin === "anonymous")).toBe(true)
})

test("uses a single post-load layout snapshot after a resize during image loading", async () => {
  const { context } = setupCanvas()
  holdImageLoads = true
  const stage = setupStage()
  let stageRect = rect(0, 0, 480, 480)
  Object.defineProperty(stage, "getBoundingClientRect", { configurable: true, value: () => stageRect })
  const slots = [...stage.querySelectorAll<HTMLElement>(".ac-slot")]
  const slotRects = [rect(6, 6, 231, 231), rect(243, 6, 231, 231), rect(6, 243, 231, 231), rect(243, 243, 231, 231)]
  slots.forEach((slot, index) => Object.defineProperty(slot, "getBoundingClientRect", {
    configurable: true,
    value: () => slotRects[index],
  }))

  const exportPromise = renderCollageBlob(template, photos, stage, "png")
  stageRect = rect(10, 20, 960, 960)
  slotRects.splice(0, slotRects.length,
    rect(22, 32, 462, 462), rect(496, 32, 462, 462),
    rect(22, 506, 462, 462), rect(496, 506, 462, 462),
  )
  pendingImageLoads.splice(0).forEach((finishLoad) => finishLoad())
  await exportPromise

  expect(context.drawImage).toHaveBeenNthCalledWith(1, mockImages[0], 100, 0, 200, 200, 30, 30, 1155, 1155)
})

test("fills slots with their preview background before drawing transparent photos", async () => {
  const { operations } = setupCanvas()
  vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
    backgroundColor: "rgb(100, 102, 100)",
  }) as CSSStyleDeclaration)

  await renderCollageBlob(template, photos, setupStage(), "png")

  expect(operations.slice(0, 3)).toEqual([
    { type: "fill", color: "#fff", rect: [0, 0, 2400, 2400] },
    { type: "fill", color: "rgb(100, 102, 100)", rect: [30, 30, 1155, 1155] },
    { type: "draw" },
  ])
})

test("uses PNG MIME for PNG exports", async () => {
  setupCanvas()
  const blob = await renderCollageBlob(template, photos, setupStage(), "png")
  expect(blob.type).toBe("image/png")
})

test("refuses a browser fallback MIME instead of downloading the wrong format", async () => {
  setupCanvas(((callback: BlobCallback) => callback(new Blob(["image"], { type: "image/png" }))) as HTMLCanvasElement["toBlob"])
  await expect(renderCollageBlob(template, photos, setupStage(), "jpeg")).rejects.toThrow(
    "couldn't export this collage as JPEG",
  )
})

test("fails clearly on an image load error without producing an export", async () => {
  shouldFailImage = true
  const { blobCallback } = setupCanvas()

  await expect(renderCollageBlob(template, photos, setupStage(), "png")).rejects.toThrow(
    "Check the image URL and cross-origin permissions",
  )
  expect(blobCallback).not.toHaveBeenCalled()
})

test("times out hung image loads and clears handlers so export can be retried", async () => {
  vi.useFakeTimers()
  holdImageLoads = true
  const { blobCallback } = setupCanvas()
  const exportPromise = renderCollageBlob(template, photos, setupStage(), "png")
  const rejection = expect(exportPromise).rejects.toThrow("timed out")

  await vi.advanceTimersByTimeAsync(15_000)
  await rejection

  expect(mockImages.every((image) => image.onload === null && image.onerror === null)).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
  expect(blobCallback).not.toHaveBeenCalled()
})

test("reports canvas taint instead of silently downloading a failed image", async () => {
  const { blobCallback } = setupCanvas((() => {
    throw new DOMException("tainted", "SecurityError")
  }) as HTMLCanvasElement["toBlob"])

  await expect(renderCollageBlob(template, photos, setupStage(), "png")).rejects.toThrow(
    "image server blocked canvas export",
  )
  expect(blobCallback).toHaveBeenCalledTimes(1)
})

test("downloads a sanitized filename with the requested extension", () => {
  const createObjectURL = vi.fn(() => "blob:collage")
  const revokeObjectURL = vi.fn()
  const URLWithBlobMethods = Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL })
  vi.stubGlobal("URL", URLWithBlobMethods)
  let downloaded: { href: string; name: string } | undefined
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloaded = { href: this.href, name: this.download }
  })
  vi.spyOn(window, "setTimeout").mockImplementation(((callback: TimerHandler) => {
    if (typeof callback === "function") callback()
    return 0
  }) as typeof window.setTimeout)

  const blob = new Blob(["image"], { type: "image/jpeg" })
  expect(downloadCollage(blob, "A/B: scene", "jpeg")).toBe("A-B--scene.jpg")
  expect(createObjectURL).toHaveBeenCalledWith(blob)
  expect(downloaded?.name).toBe("A-B--scene.jpg")
  expect(downloaded?.href).toBe("blob:collage")
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:collage")
})
