import type { Photo } from "./api.ts"

export type PhotoQuality = {
  score: number
  recommended: boolean
  resolution: number
  exposure: number
  sharpness: number
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function scoreImagePixels(
  width: number,
  height: number,
  pixels: Uint8ClampedArray,
  originalWidth: number,
  originalHeight: number,
): PhotoQuality {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4 || originalWidth <= 0 || originalHeight <= 0) {
    throw new Error("Image pixels could not be analyzed")
  }

  const luminance = new Float32Array(width * height)
  let brightness = 0
  let clipped = 0
  for (let i = 0; i < luminance.length; i += 1) {
    const offset = i * 4
    const value = (0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2]) / 255
    luminance[i] = value
    brightness += value
    if (value <= 0.02 || value >= 0.98) clipped += 1
  }
  brightness /= luminance.length

  const detail = new Float32Array((width - 2) * (height - 2))
  let at = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x
      detail[at] = Math.abs(4 * luminance[i] - luminance[i - 1] - luminance[i + 1] - luminance[i - width] - luminance[i + width])
      at += 1
    }
  }
  detail.sort()
  const strongest = Math.max(1, Math.ceil(detail.length * 0.05))
  let edgeEnergy = 0
  for (let i = detail.length - strongest; i < detail.length; i += 1) edgeEnergy += detail[i]
  edgeEnergy /= strongest

  // Resolution is capped sqrt(pixel area / Full HD); exposure combines mean luma with the clipped-pixel share.
  const resolution = clamp(Math.sqrt((originalWidth * originalHeight) / (1920 * 1080)))
  const exposure = 0.75 * clamp(1 - Math.abs(brightness - 0.5) / 0.44) +
    0.25 * clamp(1 - clipped / luminance.length / 0.08)
  // Use the strongest local detail responses so broad, naturally flat backgrounds do not lower sharpness.
  const sharpness = clamp((edgeEnergy - 0.015) / 0.12)
  // Weights are 30% resolution, 40% exposure, 30% detail; per-signal cutoffs avoid high resolution masking flaws.
  const score = Math.round((resolution * 0.3 + exposure * 0.4 + sharpness * 0.3) * 100)

  return {
    score,
    recommended: score >= 68 && resolution >= 0.45 && exposure >= 0.55 && sharpness >= 0.5,
    resolution,
    exposure,
    sharpness,
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = window.setTimeout(() => finish(new Error("Image loading timed out")), 15_000)
    const finish = (error?: Error) => {
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      if (error) reject(error)
      else resolve(image)
    }
    image.crossOrigin = "anonymous"
    image.onload = () => finish()
    image.onerror = () => finish(new Error("Image could not be loaded"))
    image.src = src
  })
}

export async function analyzePhoto(photo: Photo): Promise<PhotoQuality> {
  const image = await loadImage(photo.src)
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Image has no readable dimensions")

  const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(3, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(3, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Image pixels could not be read")
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  try {
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    return scoreImagePixels(canvas.width, canvas.height, data, image.naturalWidth, image.naturalHeight)
  } catch {
    throw new Error("Image pixels could not be read")
  }
}
