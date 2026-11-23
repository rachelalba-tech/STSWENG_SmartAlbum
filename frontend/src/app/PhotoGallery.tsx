import { useEffect, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Grid3X3, Maximize2, RotateCcw, RotateCw, Undo2 } from "lucide-react"
import "../styles/PhotoGallery.css"
import type { Photo } from "./api.ts"

type GalleryView = "grid" | "single"

type PhotoGalleryProps = {
  photos: Photo[]
  title?: string
  subtitle?: string
  emptyTitle?: string
  emptyDescription?: string
  onRemove?: (photoId: string) => void
  onSaveRotation?: (photo: Photo, degrees: number) => Promise<void>
  busy?: boolean
}

function describeRotation(netDegrees: number): string {
  if (netDegrees === 90) return "Rotated 90° clockwise"
  if (netDegrees === 180) return "Rotated 180°"
  if (netDegrees === 270) return "Rotated 90° counter-clockwise"
  return ""
}

export function PhotoGallery({
  photos,
  title = "All photos",
  subtitle = `${photos.length} uploaded photo${photos.length === 1 ? "" : "s"}`,
  emptyTitle = "No photos yet",
  emptyDescription = "Upload photos to an album and they will appear here.",
  onRemove,
  onSaveRotation,
  busy = false,
}: PhotoGalleryProps) {
  const [view, setView] = useState<GalleryView>("grid")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [rotations, setRotations] = useState<Record<string, number>>({})
  const [savingRotation, setSavingRotation] = useState(false)
  const [rotationError, setRotationError] = useState<string | null>(null)
  const [rotationSavedId, setRotationSavedId] = useState<string | null>(null)
  const safeIndex = Math.min(selectedIndex, Math.max(photos.length - 1, 0))

  const goToIndex = (updater: number | ((current: number) => number)) => {
    setRotationError(null)
    setRotationSavedId(null)
    setSelectedIndex(updater)
  }

  useEffect(() => {
    if (view !== "single" || savingRotation) return

    const moveWithKeyboard = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return
      if (event.key === "ArrowLeft") {
        setRotationError(null)
        setRotationSavedId(null)
        setSelectedIndex((current) => Math.max(current - 1, 0))
      }
      if (event.key === "ArrowRight") {
        setRotationError(null)
        setRotationSavedId(null)
        setSelectedIndex((current) => Math.min(current + 1, photos.length - 1))
      }
    }

    window.addEventListener("keydown", moveWithKeyboard)
    return () => window.removeEventListener("keydown", moveWithKeyboard)
  }, [photos.length, savingRotation, view])

  const openPhoto = (index: number) => {
    goToIndex(index)
    setView("single")
  }

  const selected = photos[safeIndex]
  const angle = selected ? (rotations[selected.id] ?? 0) : 0
  const netDegrees = ((((angle / 90) % 4) + 4) % 4) * 90
  const sideways = netDegrees === 90 || netDegrees === 270
  const hasPendingRotation = netDegrees !== 0

  const rotateSelected = (delta: 90 | -90) => {
    if (!selected || savingRotation) return
    setRotationError(null)
    setRotationSavedId(null)
    setRotations((current) => ({ ...current, [selected.id]: (current[selected.id] ?? 0) + delta }))
  }

  const handleRevertRotation = () => {
    if (!selected || savingRotation) return
    setRotationError(null)
    setRotationSavedId(null)
    setRotations((current) => {
      const next = { ...current }
      delete next[selected.id]
      return next
    })
  }

  const handleSaveRotation = async () => {
    if (!onSaveRotation || !selected || !hasPendingRotation || savingRotation) return
    const target = selected
    setSavingRotation(true)
    setRotationError(null)
    setRotationSavedId(null)
    try {
      await onSaveRotation(target, netDegrees)
      setRotations((current) => {
        const next = { ...current }
        delete next[target.id]
        return next
      })
      setRotationSavedId(target.id)
    } catch (err) {
      setRotationError(err instanceof Error ? err.message : "Could not save the rotated photo.")
    } finally {
      setSavingRotation(false)
    }
  }

  return (
    <section className="pg" aria-labelledby="photos-heading">
      <div className="pg-header">
        <div>
          <h2 id="photos-heading">{title}</h2>
          <p className="pg-subtitle">{subtitle}</p>
        </div>

        {photos.length > 0 && (
          <div className="pg-view-toggle" aria-label="Photo view">
            <button
              type="button"
              className={`pg-view-button${view === "grid" ? " is-active" : ""}`}
              aria-pressed={view === "grid"}
              disabled={savingRotation}
              onClick={() => setView("grid")}
            >
              <Grid3X3 size={17} aria-hidden="true" />
              Grid
            </button>
            <button
              type="button"
              className={`pg-view-button${view === "single" ? " is-active" : ""}`}
              aria-pressed={view === "single"}
              disabled={savingRotation}
              onClick={() => setView("single")}
            >
              <Maximize2 size={17} aria-hidden="true" />
              Single
            </button>
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
            <div className="pg-rotate-tools" role="group" aria-label="Rotate photo">
              <button
                type="button"
                className="pg-rotate pg-rotate--ccw"
                aria-label="Rotate counter-clockwise"
                title="Rotate counter-clockwise (90°)"
                disabled={savingRotation}
                onClick={() => rotateSelected(-90)}
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="pg-rotate pg-rotate--cw"
                aria-label="Rotate clockwise"
                title="Rotate clockwise (90°)"
                disabled={savingRotation}
                onClick={() => rotateSelected(90)}
              >
                <RotateCw size={18} aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              className="pg-arrow"
              aria-label="Previous photo"
              disabled={safeIndex === 0 || savingRotation}
              onClick={() => goToIndex(safeIndex - 1)}
            >
              <ChevronLeft size={26} aria-hidden="true" />
            </button>

            <figure className="pg-figure">
              <div className="pg-frame">
                <img
                  key={selected.src}
                  className={`pg-photo${sideways ? " is-sideways" : ""}`}
                  src={selected.src}
                  alt={selected.title || `Photo ${safeIndex + 1}`}
                  style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
                />
              </div>

              {hasPendingRotation && (
                <div className="pg-rotate-actions" role="group" aria-label="Rotation changes">
                  <span className="pg-rotate-label">{describeRotation(netDegrees)}</span>
                  {onSaveRotation && (
                    <button
                      type="button"
                      className="pg-rotate-btn pg-rotate-btn--primary"
                      disabled={savingRotation}
                      onClick={() => void handleSaveRotation()}
                    >
                      <Check size={15} aria-hidden="true" />
                      {savingRotation ? "Saving…" : "Save changes"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="pg-rotate-btn pg-rotate-btn--revert"
                    disabled={savingRotation}
                    onClick={handleRevertRotation}
                  >
                    <Undo2 size={15} aria-hidden="true" />
                    Revert
                  </button>
                </div>
              )}

              {rotationError && (
                <p role="alert" className="pg-rotate-error">
                  {rotationError}
                </p>
              )}

              {rotationSavedId === selected.id && !hasPendingRotation && !rotationError && (
                <p role="status" className="pg-rotate-status">
                  Rotation saved
                </p>
              )}

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
              disabled={safeIndex === photos.length - 1 || savingRotation}
              onClick={() => goToIndex(safeIndex + 1)}
            >
              <ChevronRight size={26} aria-hidden="true" />
            </button>
          </div>
          <p className="pg-keyboard-hint">Use the arrow keys to browse photos</p>
          {onRemove && <button disabled={busy || savingRotation} onClick={() => onRemove(selected.id)}>Remove {selected.title || "photo"} from album</button>}
        </div>
      )}
    </section>
  )
}
