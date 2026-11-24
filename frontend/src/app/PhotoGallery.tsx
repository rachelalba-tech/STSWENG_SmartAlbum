import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Grid3X3, Maximize2 } from "lucide-react"
import "../styles/styles.css"
import type { Photo } from "./api.ts"

type GalleryView = "grid" | "single"

type PhotoGalleryProps = {
  photos: Photo[]
  title?: string
  subtitle?: string
  emptyTitle?: string
  emptyDescription?: string
  onRemove?: (photoId: string) => void
  busy?: boolean
}

export function PhotoGallery({
  photos,
  title = "All photos",
  subtitle = `${photos.length} uploaded photo${photos.length === 1 ? "" : "s"}`,
  emptyTitle = "No photos yet",
  emptyDescription = "Upload photos to an album and they will appear here.",
  onRemove,
  busy = false,
}: PhotoGalleryProps) {
  const [view, setView] = useState<GalleryView>("grid")
  const [selectedIndex, setSelectedIndex] = useState(0)
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

  const selected = photos[safeIndex]

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
