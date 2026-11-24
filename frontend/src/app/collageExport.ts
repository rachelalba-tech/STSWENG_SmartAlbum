import type { CollageTemplate } from "./collageTemplates"

export type ExportFormat = "png" | "jpeg"

const EXPORT_SIZE = 2400
const IMAGE_LOAD_TIMEOUT_MS = 15_000

export async function renderCollageBlob(
  template: CollageTemplate,
  photos: readonly { src: string; title?: string }[],
  stage: HTMLElement,
  format: ExportFormat,
): Promise<Blob> {
  if (photos.length !== template.cells.length) throw new Error("This collage is incomplete and can't be exported.")

  const images = await Promise.all(photos.map(({ src, title }) => loadImage(src, title)))
  const stageRect = stage.getBoundingClientRect()
  const slots = [...stage.querySelectorAll<HTMLElement>(".ac-slot")]
  if (stageRect.width <= 0 || stageRect.height <= 0 || Math.abs(stageRect.width - stageRect.height) > 1) {
    throw new Error("The collage preview isn't visible at its expected square size.")
  }
  if (slots.length !== template.cells.length) throw new Error("The collage preview is incomplete. Reopen it and try again.")
  const slotSnapshots = slots.map((slot) => ({
    rect: slot.getBoundingClientRect(),
    backgroundColor: getComputedStyle(slot).backgroundColor,
  }))
  const canvas = document.createElement("canvas")
  canvas.width = EXPORT_SIZE
  canvas.height = EXPORT_SIZE
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Your browser couldn't create an export image.")

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.fillStyle = "#fff"
  context.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE)

  const scaleX = EXPORT_SIZE / stageRect.width
  const scaleY = EXPORT_SIZE / stageRect.height
  const mime = format === "png" ? "image/png" : "image/jpeg"
  try {
    images.forEach((image, index) => {
      const { rect, backgroundColor } = slotSnapshots[index]
      const x = (rect.left - stageRect.left) * scaleX
      const y = (rect.top - stageRect.top) * scaleY
      const width = rect.width * scaleX
      const height = rect.height * scaleY
      context.fillStyle = backgroundColor
      context.fillRect(x, y, width, height)
      drawCover(context, image, x, y, width, height)
    })

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error("Your browser couldn't create the export image."))
        else if (blob.type !== mime) reject(new Error(`Your browser couldn't export this collage as ${format.toUpperCase()}.`))
        else resolve(blob)
      }, mime, format === "jpeg" ? 0.92 : undefined)
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "SecurityError") {
      throw new Error("The image server blocked canvas export. Check its cross-origin image permissions and try again.", { cause: error })
    }
    throw error
  }
}

function loadImage(src: string, title = "Photo"): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error(`Couldn't load ${title || "a photo"} for export.`))
      return
    }
    const image = new Image()
    try {
      const parsed = new URL(src, document.baseURI)
      if (parsed.origin !== window.location.origin) {
        image.crossOrigin = parsed.pathname.startsWith("/api/uploads/") ? "use-credentials" : "anonymous"
      }
    } catch {
      reject(new Error(`Couldn't load ${title || "a photo"} for export.`))
      return
    }
    const timeout = window.setTimeout(() => {
      image.onload = null
      image.onerror = null
      reject(new Error(`Loading ${title || "a photo"} timed out. Check the image URL and retry.`))
    }, IMAGE_LOAD_TIMEOUT_MS)
    const finish = (result: () => void) => {
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      result()
    }
    image.onload = () => finish(() => image.naturalWidth > 0
      ? resolve(image)
      : reject(new Error(`Couldn't load ${title || "a photo"} for export.`)))
    image.onerror = () => finish(() => reject(new Error(`Couldn't load ${title || "a photo"} for export. Check the image URL and cross-origin permissions.`)))
    try {
      image.src = src
    } catch {
      finish(() => reject(new Error(`Couldn't load ${title || "a photo"} for export.`)))
    }
  })
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceAspect = image.naturalWidth / image.naturalHeight
  const targetAspect = width / height
  let sourceX = 0
  let sourceY = 0
  let sourceWidth = image.naturalWidth
  let sourceHeight = image.naturalHeight

  if (sourceAspect > targetAspect) {
    sourceWidth = image.naturalHeight * targetAspect
    sourceX = (image.naturalWidth - sourceWidth) / 2
  } else {
    sourceHeight = image.naturalWidth / targetAspect
    sourceY = (image.naturalHeight - sourceHeight) / 2
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

export function downloadCollage(blob: Blob, name: string, format: ExportFormat): string {
  const base = Array.from(name.trim(), (char) => {
    const code = char.codePointAt(0) ?? 0
    return /[<>:"/\\|?*]/.test(char) || code < 32 ? "-" : char
  }).join("").replace(/\s+/g, "-") || "collage"
  const filename = `${base}.${format === "png" ? "png" : "jpg"}`
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return filename
}
