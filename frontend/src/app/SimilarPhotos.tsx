import { useMemo, useRef, useState } from "react"
import { deletePhoto, removePhotoFromAlbum, type Photo } from "./api.ts"
import { analyzePhotoSimilarity, groupSimilarPhotos, type ImageFingerprint } from "./photoSimilarity.ts"
import "../styles/SimilarPhotos.css"

export function SimilarPhotos({
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
  const [retryingPhotoId, setRetryingPhotoId] = useState<string | null>(null)
  // Key cached fingerprints/errors by photo.src so rotating or replacing an image invalidates stale pixels.
  const [fingerprintsBySrc, setFingerprintsBySrc] = useState<Record<string, ImageFingerprint>>({})
  const [failedBySrc, setFailedBySrc] = useState<Record<string, string>>({})
  const [keptIds, setKeptIds] = useState<Set<string>>(() => new Set())
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set())
  const [activeGroupIndex, setActiveGroupIndex] = useState(0)
  const [showAllSets, setShowAllSets] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const scanRunRef = useRef(0)

  const activePhotos = useMemo(
    () => photos.filter((photo) => !removedIds.has(photo.id)),
    [photos, removedIds],
  )

  const groups = useMemo(() => {
    const entries = activePhotos.flatMap((photo) => {
      const fingerprint = fingerprintsBySrc[photo.src]
      return fingerprint ? [{ photo, fingerprint }] : []
    })
    return groupSimilarPhotos(entries)
  }, [activePhotos, fingerprintsBySrc])

  const failedPhotos = useMemo(
    () => activePhotos.filter((photo) => Boolean(failedBySrc[photo.src])),
    [activePhotos, failedBySrc],
  )

  const safeGroupIndex = Math.min(activeGroupIndex, Math.max(groups.length - 1, 0))
  const visibleGroups = showAllSets ? groups : groups.slice(safeGroupIndex, safeGroupIndex + 1)

  async function scan() {
    const runId = scanRunRef.current + 1
    scanRunRef.current = runId
    setVisible(true)
    setLoading(true)
    setError(null)
    setStatus("")
    setActiveGroupIndex(0)

    const nextFingerprints: Record<string, ImageFingerprint> = {}
    const nextFailed: Record<string, string> = {}

    for (const photo of activePhotos) {
      if (scanRunRef.current !== runId) return
      if (nextFingerprints[photo.src] || nextFailed[photo.src]) continue
      try {
        nextFingerprints[photo.src] = await analyzePhotoSimilarity(photo)
      } catch (err) {
        nextFailed[photo.src] = err instanceof Error ? err.message : "Could not analyze this photo"
      }
    }

    if (scanRunRef.current !== runId) return
    setFingerprintsBySrc(nextFingerprints)
    setFailedBySrc(nextFailed)
    setScanned(true)
    setLoading(false)
  }

  async function retryPhoto(photo: Photo) {
    setRetryingPhotoId(photo.id)
    setError(null)
    try {
      const fingerprint = await analyzePhotoSimilarity(photo)
      setFingerprintsBySrc((current) => ({ ...current, [photo.src]: fingerprint }))
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

  const busy = busyPhotoId !== null || retryingPhotoId !== null

  return (
    <section className="sp" aria-label="Similar photos">
      <div className="sp-actions">
        <button type="button" className="sp-button" onClick={() => void scan()} disabled={loading || busy}>
          {loading ? "Finding similar photos…" : scanned ? "Rescan similar photos" : "Find similar photos"}
        </button>
        {visible && !loading && groups.length > 1 && (
          <button
            type="button"
            className="sp-button"
            onClick={() => setShowAllSets((current) => !current)}
            disabled={busy}
          >
            {showAllSets ? "Review one set at a time" : `Show all sets (${groups.length})`}
          </button>
        )}
      </div>

      <p className="sp-scope">
        Visually similar photos are grouped by matching structure, layout, and colors so you can pick the best shot.{" "}
        {albumId
          ? "Deleting a photo here only removes it from this album; it stays in your library."
          : "Deleting a photo here removes it from your library and every album where it appears."}
      </p>

      {status && <p className="sp-status" role="status">{status}</p>}
      {error && (
        <p className="sp-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="sp-status" role="status">Comparing photos for visual similarity…</p>}

      {visible && !loading && scanned && (
        <>
          {groups.length === 0 ? (
            <p className="sp-empty">No visually similar photos found.</p>
          ) : (
            <div className="sp-results">
              {!showAllSets && groups.length > 1 && (
                <div className="sp-pager" role="navigation" aria-label="Similar photo sets">
                  <button
                    type="button"
                    className="sp-button"
                    disabled={safeGroupIndex === 0 || busy}
                    onClick={() => setActiveGroupIndex((index) => Math.max(index - 1, 0))}
                  >
                    Previous set
                  </button>
                  <span className="sp-pager-label">
                    Set {safeGroupIndex + 1} of {groups.length}
                  </span>
                  <button
                    type="button"
                    className="sp-button"
                    disabled={safeGroupIndex >= groups.length - 1 || busy}
                    onClick={() => setActiveGroupIndex((index) => Math.min(index + 1, groups.length - 1))}
                  >
                    Next set
                  </button>
                </div>
              )}

              <div className="sp-groups">
                {visibleGroups.map((group, visibleIndex) => {
                  const setNumber = showAllSets ? visibleIndex + 1 : safeGroupIndex + 1
                  return (
                    <article className="sp-group" key={group.id} aria-label={`Similar set ${setNumber}`}>
                      <header className="sp-group-header">
                        <strong>Similar set {setNumber}</strong>
                        <span>
                          {group.photos.length} photos · {group.similarity}% visual match
                        </span>
                      </header>
                      <div className="sp-group-grid">
                        {group.photos.map(({ photo, quality }, index) => {
                          const kept = keptIds.has(photo.id)
                          const isDeleting = busyPhotoId === photo.id
                          return (
                            <div className="sp-photo" key={photo.id}>
                              <a
                                href={photo.src}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`View full-size ${photo.title || "similar photo"}`}
                              >
                                <img src={photo.thumbnail} alt={photo.title || "Similar photo"} />
                              </a>
                              <span className="sp-photo-title">{photo.title || "Untitled photo"}</span>
                              <span className="sp-photo-meta">
                                {index === 0 ? "Suggested best shot · " : ""}
                                Quality {quality.score}/100
                              </span>
                              <div className="sp-photo-actions">
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
                                    className="sp-delete"
                                    onClick={() => void removeOne(photo)}
                                    disabled={busy}
                                  >
                                    {isDeleting ? "Deleting…" : albumId ? "Remove from album" : "Delete photo"}
                                  </button>
                                )}
                                {kept && <span className="sp-kept">Kept</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}

          {failedPhotos.length > 0 && (
            <section className="sp-analysis-errors" aria-label="Photos that could not be compared">
              <h4>
                Could not compare {failedPhotos.length} photo{failedPhotos.length === 1 ? "" : "s"}
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
