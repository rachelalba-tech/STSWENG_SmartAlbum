import type { Photo } from "./api.ts"
import { loadImage, scoreImagePixels, type PhotoQuality } from "./photoQuality.ts"

export type ImageFingerprint = {
  dHash: Uint8Array
  spatialRgb: Float32Array
  colorHist: Float32Array
  quality: PhotoQuality
}

export type SimilarityMatch = {
  score: number
  dHashSimilarity: number
  spatialSimilarity: number
  colorSimilarity: number
  similar: boolean
}

export type SimilarPhotoItem = {
  photo: Photo
  quality: PhotoQuality
}

export type SimilarPhotoGroup = {
  id: string
  similarity: number
  photos: SimilarPhotoItem[]
}

const DHASH_COLS = 9
const DHASH_ROWS = 8
const SPATIAL_GRID = 4
const HIST_BINS_PER_CHANNEL = 4
const HIST_SIZE = HIST_BINS_PER_CHANNEL ** 3

const SIMILARITY_THRESHOLD = 0.78
const MIN_DHASH_SIMILARITY = 0.72
const MIN_SPATIAL_SIMILARITY = 0.75

export function extractImageFingerprint(
  width: number,
  height: number,
  pixels: Uint8ClampedArray,
  originalWidth: number,
  originalHeight: number,
): ImageFingerprint {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4 || originalWidth <= 0 || originalHeight <= 0) {
    throw new Error("Image pixels could not be analyzed")
  }

  const quality = scoreImagePixels(width, height, pixels, originalWidth, originalHeight)

  // 1. 9x8 area-averaged grayscale grid -> 64-bit horizontal difference hash (dHash).
  const graySum = new Float64Array(DHASH_COLS * DHASH_ROWS)
  const grayCount = new Uint32Array(DHASH_COLS * DHASH_ROWS)

  // 2. 4x4 area-averaged RGB grid -> 48 normalized spatial color features.
  const spatialSum = new Float64Array(SPATIAL_GRID * SPATIAL_GRID * 3)
  const spatialCount = new Uint32Array(SPATIAL_GRID * SPATIAL_GRID)

  // 3. 4x4x4 RGB color histogram -> 64 normalized color distribution bins.
  const colorHist = new Float32Array(HIST_SIZE)

  const totalPixels = width * height
  for (let y = 0; y < height; y += 1) {
    const gy = Math.min(DHASH_ROWS - 1, Math.floor((y * DHASH_ROWS) / height))
    const sy = Math.min(SPATIAL_GRID - 1, Math.floor((y * SPATIAL_GRID) / height))
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const r = pixels[offset]
      const g = pixels[offset + 1]
      const b = pixels[offset + 2]

      const gx = Math.min(DHASH_COLS - 1, Math.floor((x * DHASH_COLS) / width))
      const gIndex = gy * DHASH_COLS + gx
      graySum[gIndex] += 0.2126 * r + 0.7152 * g + 0.0722 * b
      grayCount[gIndex] += 1

      const sx = Math.min(SPATIAL_GRID - 1, Math.floor((x * SPATIAL_GRID) / width))
      const sCell = sy * SPATIAL_GRID + sx
      const sOffset = sCell * 3
      spatialSum[sOffset] += r
      spatialSum[sOffset + 1] += g
      spatialSum[sOffset + 2] += b
      spatialCount[sCell] += 1

      const rb = Math.min(HIST_BINS_PER_CHANNEL - 1, r >> 6)
      const gb = Math.min(HIST_BINS_PER_CHANNEL - 1, g >> 6)
      const bb = Math.min(HIST_BINS_PER_CHANNEL - 1, b >> 6)
      colorHist[(rb * HIST_BINS_PER_CHANNEL + gb) * HIST_BINS_PER_CHANNEL + bb] += 1
    }
  }

  const dHash = new Uint8Array(64)
  for (let y = 0; y < DHASH_ROWS; y += 1) {
    for (let x = 0; x < DHASH_COLS - 1; x += 1) {
      const leftIdx = y * DHASH_COLS + x
      const rightIdx = leftIdx + 1
      const leftMean = grayCount[leftIdx] ? graySum[leftIdx] / grayCount[leftIdx] : 0
      const rightMean = grayCount[rightIdx] ? graySum[rightIdx] / grayCount[rightIdx] : 0
      dHash[y * (DHASH_COLS - 1) + x] = leftMean > rightMean ? 1 : 0
    }
  }

  const spatialRgb = new Float32Array(SPATIAL_GRID * SPATIAL_GRID * 3)
  for (let cell = 0; cell < SPATIAL_GRID * SPATIAL_GRID; cell += 1) {
    const count = spatialCount[cell] || 1
    const base = cell * 3
    spatialRgb[base] = spatialSum[base] / (count * 255)
    spatialRgb[base + 1] = spatialSum[base + 1] / (count * 255)
    spatialRgb[base + 2] = spatialSum[base + 2] / (count * 255)
  }

  for (let i = 0; i < HIST_SIZE; i += 1) {
    colorHist[i] /= totalPixels
  }

  return { dHash, spatialRgb, colorHist, quality }
}

export function compareFingerprints(a: ImageFingerprint, b: ImageFingerprint): SimilarityMatch {
  let hamming = 0
  for (let i = 0; i < 64; i += 1) {
    if (a.dHash[i] !== b.dHash[i]) hamming += 1
  }
  const dHashSimilarity = 1 - hamming / 64

  let spatialDiff = 0
  for (let i = 0; i < a.spatialRgb.length; i += 1) {
    spatialDiff += Math.abs(a.spatialRgb[i] - b.spatialRgb[i])
  }
  const spatialSimilarity = 1 - spatialDiff / a.spatialRgb.length

  let colorSimilarity = 0
  for (let i = 0; i < a.colorHist.length; i += 1) {
    colorSimilarity += Math.min(a.colorHist[i], b.colorHist[i])
  }

  const score = 0.4 * dHashSimilarity + 0.35 * spatialSimilarity + 0.25 * colorSimilarity
  const similar =
    score >= SIMILARITY_THRESHOLD &&
    dHashSimilarity >= MIN_DHASH_SIMILARITY &&
    spatialSimilarity >= MIN_SPATIAL_SIMILARITY

  return { score, dHashSimilarity, spatialSimilarity, colorSimilarity, similar }
}

export function groupSimilarPhotos(
  entries: Array<{ photo: Photo; fingerprint: ImageFingerprint }>,
): SimilarPhotoGroup[] {
  // Deduplicate by src so shared-file memberships of one upload are not grouped with themselves.
  const unique: Array<{ photo: Photo; fingerprint: ImageFingerprint }> = []
  const seenSrc = new Set<string>()
  for (const entry of entries) {
    if (seenSrc.has(entry.photo.src)) continue
    seenSrc.add(entry.photo.src)
    unique.push(entry)
  }

  const n = unique.length
  if (n < 2) return []

  const parent = Array.from({ length: n }, (_, index) => index)
  const find = (x: number): number => {
    let root = x
    while (parent[root] !== root) root = parent[root]
    let curr = x
    while (parent[curr] !== root) {
      const next = parent[curr]
      parent[curr] = root
      curr = next
    }
    return root
  }
  const unite = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  const matchingPairs: Array<{ i: number; j: number; score: number }> = []
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const match = compareFingerprints(unique[i].fingerprint, unique[j].fingerprint)
      if (match.similar) {
        unite(i, j)
        matchingPairs.push({ i, j, score: match.score })
      }
    }
  }

  const membersByRoot = new Map<number, number[]>()
  for (let i = 0; i < n; i += 1) {
    const root = find(i)
    const list = membersByRoot.get(root)
    if (list) list.push(i)
    else membersByRoot.set(root, [i])
  }

  const pairScoresByRoot = new Map<number, number[]>()
  for (const pair of matchingPairs) {
    const root = find(pair.i)
    const list = pairScoresByRoot.get(root)
    if (list) list.push(pair.score)
    else pairScoresByRoot.set(root, [pair.score])
  }

  const groups: SimilarPhotoGroup[] = []
  for (const [root, indices] of membersByRoot) {
    if (indices.length < 2) continue
    const scores = pairScoresByRoot.get(root) ?? []
    const average = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : SIMILARITY_THRESHOLD
    const items = indices
      .map((index) => ({
        photo: unique[index].photo,
        quality: unique[index].fingerprint.quality,
        order: index,
      }))
      .sort((a, b) => b.quality.score - a.quality.score || a.order - b.order)
      .map(({ photo, quality }) => ({ photo, quality }))

    groups.push({
      id: items.map((item) => item.photo.id).join("|"),
      similarity: Math.round(average * 100),
      photos: items,
    })
  }

  return groups.sort((a, b) => b.similarity - a.similarity)
}

export async function analyzePhotoSimilarity(photo: Photo): Promise<ImageFingerprint> {
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
    return extractImageFingerprint(canvas.width, canvas.height, data, image.naturalWidth, image.naturalHeight)
  } catch {
    throw new Error("Image pixels could not be read")
  }
}
