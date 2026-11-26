import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Grid3X3, Maximize2 } from "lucide-react"
import "../styles/styles.css"
import { addPhotosToAlbum, type Album, type Photo } from "./api.ts"
import { analyzePhoto, type PhotoQuality } from "./photoQuality.ts"

type GalleryView = "grid" | "single" | "recommendations"
type PhotoAnalysis = { quality?: PhotoQuality; error?: string }

type PhotoGalleryProps = {
  photos: Photo[]
  albums?: Album[]
  title?: string
  subtitle?: string
  emptyTitle?: string
  emptyDescription?: string
  onRemove?: (photoId: string) => void
  busy?: boolean
}

export function PhotoGallery({
  photos,
  albums,
  title = "All photos",
  subtitle = `${photos.length} uploaded photo${photos.length === 1 ? "" : "s"}`,
  emptyTitle = "No photos yet",
  emptyDescription = "Upload photos to an album and they will appear here.",
  onRemove,
  busy = false,
}: PhotoGalleryProps) {
  const [view, setView] = useState<GalleryView>("grid")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [analysis, setAnalysis] = useState<Record<string, PhotoAnalysis>>({})
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [retryingPhotoId, setRetryingPhotoId] = useState<string | null>(null)
  const [selectedAlbumId, setSelectedAlbumId] = useState("")
  const [addingPhotoId, setAddingPhotoId] = useState<string | null>(null)
  const [addedToByPhoto, setAddedToByPhoto] = useState<Record<string, string>>({})
  const [addError, setAddError] = useState<string | null>(null)
  const [addStatus, setAddStatus] = useState<{ message: string; albumId: string } | null>(null)
  const safeIndex = Math.min(selectedIndex, Math.max(photos.length - 1, 0))

  useEffect(() => {
    if (view !== "single") return

    const moveWithKeyboard = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return
      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) => Math.max(current - 1, 0))
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((current) => Math.min(current + 1, photos.length - 1))
      }
    }

    window.addEventListener("keydown", moveWithKeyboard)
    return () => window.removeEventListener("keydown", moveWithKeyboard)
  }, [photos.length, view])

  const openPhoto = (index: number) => {
    setSelectedIndex(index)
    setView("single")
  }

  async function runRecommendations() {
    setAnalysisLoading(true)
    setAnalysis({})
    const results: Array<[string, PhotoAnalysis]> = []
    for (const photo of photos) {
      try {
        results.push([photo.id, { quality: await analyzePhoto(photo) }])
      } catch (error) {
        results.push([photo.id, { error: error instanceof Error ? error.message : "Could not analyze this photo" }])
      }
    }
    setAnalysis(Object.fromEntries(results))
    setAnalysisLoading(false)
  }

  async function retryAnalysis(photo: Photo) {
    setRetryingPhotoId(photo.id)
    try {
      const quality = await analyzePhoto(photo)
      setAnalysis((current) => ({ ...current, [photo.id]: { quality } }))
    } catch (error) {
      setAnalysis((current) => ({
        ...current,
        [photo.id]: { error: error instanceof Error ? error.message : "Could not analyze this photo" },
      }))
    } finally {
      setRetryingPhotoId(null)
    }
  }

  async function addPhoto(photo: Photo) {
    const album = (albums ?? []).find((item) => item.id === selectedAlbumId)
    if (!album) return
    setAddingPhotoId(photo.id)
    setAddError(null)
    setAddStatus(null)
    try {
      await addPhotosToAlbum(album.id, [photo.id])
      setAddedToByPhoto((current) => ({ ...current, [photo.id]: album.id }))
      setAddStatus({ message: `Added ${photo.title || "photo"} to ${album.title}.`, albumId: album.id })
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Could not add photo to album. Try again.")
    } finally {
      setAddingPhotoId(null)
    }
  }

  const selected = photos[safeIndex]
  const recommended = photos
    .flatMap((photo) => {
      const quality = analysis[photo.id]?.quality
      return quality?.recommended ? [{ photo, quality }] : []
    })
    .sort((a, b) => b.quality.score - a.quality.score)
  const failedAnalysis = photos.filter((photo) => analysis[photo.id]?.error)
  const notRecommendedCount = photos.filter((photo) => analysis[photo.id]?.quality && !analysis[photo.id].quality?.recommended).length

  return (
    <section className="pg" aria-labelledby="photos-heading">
      <div className="pg-header">
        <div>
          <h2 className="pg=title" id="photos-heading">{title}</h2>
          <p className="pg-subtitle">{subtitle}</p>
        </div>

        {photos.length > 0 && (
          <div className="pg-view-toggle" aria-label="Photo view">
            <button
              type="button"
              className={`pg-view-button${view === "grid" ? " is-active" : ""}`}
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <Grid3X3 size={17} aria-hidden="true" />
              Grid
            </button>
            <button
              type="button"
              className={`pg-view-button${view === "single" ? " is-active" : ""}`}
              aria-pressed={view === "single"}
              onClick={() => setView("single")}
            >
              <Maximize2 size={17} aria-hidden="true" />
              Single
            </button>
            {albums !== undefined && (
              <button
                type="button"
                className={`pg-view-button${view === "recommendations" ? " is-active" : ""}`}
                aria-pressed={view === "recommendations"}
                disabled={analysisLoading}
                onClick={() => {
                  setView("recommendations")
                  void runRecommendations()
                }}
              >
                Recommend best photos
              </button>
            )}
          </div>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="pg-empty">
          <Grid3X3 size={32} aria-hidden="true" />
          <h3>{emptyTitle}</h3>
          <p>{emptyDescription}</p>
          <a href="#/upload">Upload photos</a>
        </div>
      ) : view === "recommendations" ? (
        <div className="pg-recommendations" aria-labelledby="pg-recommendations-heading">
          <div className="pg-recommendations-header">
            <div>
              <h3 id="pg-recommendations-heading">Recommended photos</h3>
              <p>Recommendations use image resolution, lighting, and sharpness as signals. They are heuristic suggestions—review each photo before adding it to an album.</p>
            </div>
            <button type="button" className="pg-retry-analysis" disabled={analysisLoading} onClick={() => void runRecommendations()}>
              {analysisLoading ? "Checking photos…" : "Retry quality check"}
            </button>
          </div>
          {analysisLoading && <p role="status">Checking photo quality…</p>}
          {!analysisLoading && recommended.length === 0 && (
            <p role="status" className="pg-no-recommendations">
              No confident recommendations. Photos that are blurry, poorly exposed, too small, or could not be assessed are not recommended.
            </p>
          )}
          {!analysisLoading && recommended.length > 0 && (
            <>
              <div className="pg-add-target">
                <label htmlFor="pg-target-album">Add recommended photos to</label>
                <select id="pg-target-album" value={selectedAlbumId} onChange={(event) => setSelectedAlbumId(event.target.value)}>
                  <option value="">Choose an existing album</option>
                  {(albums ?? []).map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
                </select>
              </div>
              {(albums ?? []).length === 0 && <p>No existing albums are available. Create an album before adding photos.</p>}
              {addError && <p role="alert" className="pg-add-error">{addError}</p>}
              {addStatus && (
                <p role="status" className="pg-add-status">
                  {addStatus.message} <a href={`#/albums/${encodeURIComponent(addStatus.albumId)}`}>View album</a>
                </p>
              )}
              <ul className="pg-grid pg-recommended-grid">
                {recommended.map(({ photo, quality }) => (
                  <li key={photo.id}>
                    <article className="pg-recommended-card">
                      <img src={photo.thumbnail} alt={photo.title || "Recommended photo"} loading="lazy" />
                      <div className="pg-recommended-info">
                        <strong>{photo.title || "Untitled photo"}</strong>
                        <span>Visual quality {quality.score}/100 · clear details · balanced exposure</span>
                        <button
                          type="button"
                          disabled={!selectedAlbumId || addingPhotoId !== null || addedToByPhoto[photo.id] === selectedAlbumId}
                          onClick={() => void addPhoto(photo)}
                        >
                          {addingPhotoId === photo.id ? "Adding…" : addedToByPhoto[photo.id] === selectedAlbumId ? "Added" : "Add to album"}
                        </button>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!analysisLoading && notRecommendedCount > 0 && (
            <p className="pg-filtered-count">{notRecommendedCount} photo{notRecommendedCount === 1 ? "" : "s"} did not meet the quality threshold.</p>
          )}
          {!analysisLoading && failedAnalysis.length > 0 && (
            <section className="pg-analysis-errors" aria-label="Photos that could not be assessed">
              <h4>Could not assess {failedAnalysis.length} photo{failedAnalysis.length === 1 ? "" : "s"}</h4>
              <ul>
                {failedAnalysis.map((photo) => (
                  <li key={photo.id}>
                    <span>{photo.title || "Untitled photo"}: {analysis[photo.id].error}</span>
                    <button type="button" disabled={retryingPhotoId !== null} onClick={() => void retryAnalysis(photo)}>
                      {retryingPhotoId === photo.id ? "Retrying…" : "Retry"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : view === "grid" ? (
        <ul className="pg-grid">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                className="pg-tile"
                onClick={() => openPhoto(index)}
                aria-label={`Open ${photo.title || `photo ${index + 1}`}`}
              >
                <img
                  src={photo.thumbnail}
                  alt={photo.title || `Photo ${index + 1}`}
                  loading="lazy"
                />
                <span>{photo.title || `Photo ${index + 1}`}</span>
              </button>
              {onRemove && <button disabled={busy} onClick={() => onRemove(photo.id)}>Remove {photo.title || "photo"} from album</button>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="pg-single" aria-live="polite">
          <div className="pg-stage">
            <button
              type="button"
              className="pg-arrow"
              aria-label="Previous photo"
              disabled={safeIndex === 0}
              onClick={() => setSelectedIndex(safeIndex - 1)}
            >
              <ChevronLeft size={26} aria-hidden="true" />
            </button>

            <figure className="pg-figure">
              <img
                src={selected.src}
                alt={selected.title || `Photo ${safeIndex + 1}`}
              />
              <figcaption>
                <strong>{selected.title || `Photo ${safeIndex + 1}`}</strong>
                <span>
                  {safeIndex + 1} of {photos.length}
                </span>
              </figcaption>
            </figure>

            <button
              type="button"
              className="pg-arrow"
              aria-label="Next photo"
              disabled={safeIndex === photos.length - 1}
              onClick={() => setSelectedIndex(safeIndex + 1)}
            >
              <ChevronRight size={26} aria-hidden="true" />
            </button>
          </div>
          <p className="pg-keyboard-hint">Use the arrow keys to browse photos</p>
          {onRemove && <button disabled={busy} onClick={() => onRemove(selected.id)}>Remove {selected.title || "photo"} from album</button>}
        </div>
      )}
    </section>
  )
}
