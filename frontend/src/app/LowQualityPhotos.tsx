import { useMemo, useRef, useState } from "react"
import { deletePhoto, removePhotoFromAlbum, type Photo } from "./api.ts"
import { analyzePhoto, getLowQualityReasons, type PhotoQuality } from "./photoQuality.ts"
import "../styles/LowQualityPhotos.css"

export function LowQualityPhotos({
  photos,
  albumId,
  onPhotosChanged = () => {},
}: {
  photos: Photo[]
  albumId?: string
  onPhotosChanged?: () => void | Promise<void>
}) {
  const [visible, setVisible] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [retryingPhotoId, setRetryingPhotoId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  // Key cached quality/errors by photo.src so rotating or replacing an image invalidates stale pixels.
  const [qualityBySrc, setQualityBySrc] = useState<Record<string, PhotoQuality>>({})
  const [failedBySrc, setFailedBySrc] = useState<Record<string, string>>({})
  const [keptIds, setKeptIds] = useState<Set<string>>(() => new Set())
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [showAll, setShowAll] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const scanRunRef = useRef(0)

  const activePhotos = useMemo(
    () => photos.filter((photo) => !removedIds.has(photo.id)),
    [photos, removedIds],
  )

  const flaggedPhotos = useMemo(
    () =>
      activePhotos
        .flatMap((photo) => {
          const quality = qualityBySrc[photo.src]
          if (!quality) return []
          const reasons = getLowQualityReasons(quality)
          return reasons.length > 0 ? [{ photo, quality, reasons }] : []
        })
        .sort((a, b) => a.quality.score - b.quality.score),
    [activePhotos, qualityBySrc],
  )

  const pendingPhotos = useMemo(
    () => flaggedPhotos.filter(({ photo }) => !keptIds.has(photo.id)),
    [flaggedPhotos, keptIds],
  )

  const failedPhotos = useMemo(
    () => activePhotos.filter((photo) => Boolean(failedBySrc[photo.src])),
    [activePhotos, failedBySrc],
  )

  const safeIndex = Math.min(activeIndex, Math.max(flaggedPhotos.length - 1, 0))
  const visibleFlagged = showAll ? flaggedPhotos : flaggedPhotos.slice(safeIndex, safeIndex + 1)

  async function scan() {
    const runId = scanRunRef.current + 1
    scanRunRef.current = runId
    setVisible(true)
    setLoading(true)
    setConfirming(false)
    setError(null)
    setStatus("")
    setActiveIndex(0)

    const nextQuality: Record<string, PhotoQuality> = {}
    const nextFailed: Record<string, string> = {}

    for (const photo of activePhotos) {
      if (scanRunRef.current !== runId) return
      if (nextQuality[photo.src] || nextFailed[photo.src]) continue
      try {
        nextQuality[photo.src] = await analyzePhoto(photo)
      } catch (err) {
        nextFailed[photo.src] = err instanceof Error ? err.message : "Could not analyze this photo"
      }
    }

    if (scanRunRef.current !== runId) return
    setQualityBySrc(nextQuality)
    setFailedBySrc(nextFailed)
    setScanned(true)
    setLoading(false)
  }

  async function retryPhoto(photo: Photo) {
    setRetryingPhotoId(photo.id)
    setError(null)
    try {
      const quality = await analyzePhoto(photo)
      setQualityBySrc((current) => ({ ...current, [photo.src]: quality }))
      setFailedBySrc((current) => {
        const next = { ...current }
        delete next[photo.src]
        return next
      })
    } catch (err) {
      setFailedBySrc((current) => ({
        ...current,
        [photo.src]: err instanceof Error ? err.message : "Could not analyze this photo",
      }))
    } finally {
      setRetryingPhotoId(null)
    }
  }

  async function removeOne(photo: Photo) {
    setBusyPhotoId(photo.id)
    setError(null)
    setConfirming(false)
    try {
      if (albumId) {
        await removePhotoFromAlbum(albumId, photo.id)
      } else {
        await deletePhoto(photo.id)
      }
      setRemovedIds((current) => new Set(current).add(photo.id))
      setKeptIds((current) => {
        const next = new Set(current)
        next.delete(photo.id)
        return next
      })
      const label = photo.title || "photo"
      setStatus(
        albumId
          ? `Removed ${label} from this album. It remains in your library.`
          : `Deleted ${label} from your library and all albums.`,
      )
      await onPhotosChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete photo")
    } finally {
      setBusyPhotoId(null)
    }
  }

  async function removeAllPending() {
    const targets = pendingPhotos.map(({ photo }) => photo)
    if (targets.length === 0) return
    setBulkDeleting(true)
    setError(null)
    setConfirming(false)

    const removedNow: string[] = []
    let firstError: string | null = null

    for (const photo of targets) {
      try {
        if (albumId) {
          await removePhotoFromAlbum(albumId, photo.id)
        } else {
          await deletePhoto(photo.id)
        }
        removedNow.push(photo.id)
      } catch (err) {
        if (!firstError) {
          firstError = err instanceof Error ? err.message : "Could not delete low-quality photos"
        }
      }
    }

    if (removedNow.length > 0) {
      const removedSet = new Set(removedNow)
      setRemovedIds((current) => new Set([...current, ...removedNow]))
      setKeptIds((current) => {
        const next = new Set(current)
        for (const id of removedSet) next.delete(id)
        return next
      })
      setStatus(
        albumId
          ? `Removed ${removedNow.length} low-quality ${removedNow.length === 1 ? "photo" : "photos"} from this album. They remain in your library.`
          : `Deleted ${removedNow.length} low-quality ${removedNow.length === 1 ? "photo" : "photos"} from your library and all albums.`,
      )
      try {
        await onPhotosChanged()
      } catch (err) {
        if (!firstError) {
          firstError = err instanceof Error ? err.message : "Could not refresh photos"
        }
      }
    }

    if (firstError) setError(firstError)
    setBulkDeleting(false)
  }

  const busy = busyPhotoId !== null || bulkDeleting || retryingPhotoId !== null

  return (
    <section className="lq" aria-label="Low quality photos">
      <div className="lq-actions">
        <button type="button" className="lq-button" onClick={() => void scan()} disabled={loading || busy}>
          {loading
            ? "Finding low quality photos…"
            : scanned
              ? "Rescan low quality photos"
              : "Find low quality photos"}
        </button>
        {visible && !loading && flaggedPhotos.length > 0 && (
          <button
            type="button"
            className="lq-button lq-button--danger"
            onClick={() => setConfirming(true)}
            disabled={busy || pendingPhotos.length === 0}
          >
            {albumId
              ? `Remove all flagged (${pendingPhotos.length})`
              : `Delete all flagged (${pendingPhotos.length})`}
          </button>
        )}
        {visible && !loading && flaggedPhotos.length > 1 && (
          <button
            type="button"
            className="lq-button"
            onClick={() => setShowAll((current) => !current)}
            disabled={busy}
          >
            {showAll ? "Review one at a time" : `Show all flagged (${flaggedPhotos.length})`}
          </button>
        )}
      </div>

      <p className="lq-scope">
        Photos that are blurry, poorly exposed, backlit, or low resolution are flagged with quality warnings.{" "}
        {albumId
          ? "Removing a photo here only removes it from this album; it stays in your library."
          : "Deleting a photo here removes it from your library and every album where it appears."}
      </p>

      {status && <p className="lq-status" role="status">{status}</p>}
      {error && (
        <p className="lq-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="lq-status" role="status">Checking photos for blur, exposure, and resolution…</p>}

      {confirming && (
        <div className="lq-confirm" role="group" aria-label="Confirm low-quality photo deletion">
          <p>
            {albumId
              ? `Remove ${pendingPhotos.length} flagged low-quality ${pendingPhotos.length === 1 ? "photo" : "photos"} from this album? Kept photos will remain, and removed photos stay in your library.`
              : `Delete ${pendingPhotos.length} flagged low-quality ${pendingPhotos.length === 1 ? "photo" : "photos"} from your library and all albums? Kept photos will remain.`}
          </p>
          <button
            type="button"
            className="lq-button lq-button--danger"
            onClick={() => void removeAllPending()}
            disabled={loading || busy || pendingPhotos.length === 0}
          >
            {albumId ? "Confirm remove all flagged" : "Confirm delete all flagged"}
          </button>
          <button type="button" className="lq-button" onClick={() => setConfirming(false)} disabled={loading || busy}>
            Cancel
          </button>
        </div>
      )}

      {visible && !loading && scanned && (
        <>
          {flaggedPhotos.length === 0 ? (
            <p className="lq-empty">No low-quality photos found.</p>
          ) : (
            <div className="lq-results">
              {!showAll && flaggedPhotos.length > 1 && (
                <div className="lq-pager" role="navigation" aria-label="Flagged low-quality photos">
                  <button
                    type="button"
                    className="lq-button"
                    disabled={safeIndex === 0 || busy}
                    onClick={() => setActiveIndex((index) => Math.max(index - 1, 0))}
                  >
                    Previous photo
                  </button>
                  <span className="lq-pager-label">
                    Photo {safeIndex + 1} of {flaggedPhotos.length}
                  </span>
                  <button
                    type="button"
                    className="lq-button"
                    disabled={safeIndex >= flaggedPhotos.length - 1 || busy}
                    onClick={() => setActiveIndex((index) => Math.min(index + 1, flaggedPhotos.length - 1))}
                  >
                    Next photo
                  </button>
                </div>
              )}

              <div className="lq-panel">
                <header className="lq-panel-header">
                  <strong>Flagged low-quality photos</strong>
                  <span>
                    {flaggedPhotos.length} {flaggedPhotos.length === 1 ? "photo" : "photos"} flagged
                  </span>
                </header>
                <div className="lq-grid">
                  {visibleFlagged.map(({ photo, reasons }) => {
                    const kept = keptIds.has(photo.id)
                    const isDeleting = busyPhotoId === photo.id
                    return (
                      <article className="lq-photo" key={photo.id}>
                        <a
                          href={photo.src}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`View full-size ${photo.title || "low-quality photo"}`}
                        >
                          <img src={photo.thumbnail} alt={photo.title || "Low-quality photo"} />
                        </a>
                        <span className="lq-photo-title">{photo.title || "Untitled photo"}</span>
                        <div className="lq-flags" aria-label="Quality warnings">
                          {reasons.map((reason) => (
                            <span className="lq-flag" key={reason}>
                              {reason}
                            </span>
                          ))}
                        </div>
                        <div className="lq-photo-actions">
                          {kept ? (
                            <button
                              type="button"
                              onClick={() =>
                                setKeptIds((current) => {
                                  const next = new Set(current)
                                  next.delete(photo.id)
                                  return next
                                })
                              }
                              disabled={busy}
                            >
                              Undo keep
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setKeptIds((current) => new Set(current).add(photo.id))}
                              disabled={busy}
                            >
                              Keep photo
                            </button>
                          )}
                          {!kept && (
                            <button
                              type="button"
                              className="lq-delete"
                              onClick={() => void removeOne(photo)}
                              disabled={busy}
                            >
                              {isDeleting ? "Deleting…" : albumId ? "Remove from album" : "Delete photo"}
                            </button>
                          )}
                          {kept && <span className="lq-kept">Kept</span>}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {failedPhotos.length > 0 && (
            <section className="lq-analysis-errors" aria-label="Photos that could not be checked">
              <h4>
                Could not check {failedPhotos.length} photo{failedPhotos.length === 1 ? "" : "s"}
              </h4>
              <ul>
                {failedPhotos.map((photo) => (
                  <li key={photo.id}>
                    <span>
                      {photo.title || "Untitled photo"}: {failedBySrc[photo.src]}
                    </span>
                    <button type="button" disabled={busy} onClick={() => void retryPhoto(photo)}>
                      {retryingPhotoId === photo.id ? "Retrying…" : "Retry"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  )
}
