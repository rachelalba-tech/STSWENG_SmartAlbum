import { useCallback, useId, useRef, useState } from "react"
import type { Album, Photo } from "./api.ts"
import { CollageLayout } from "./AlbumCollage"
import { downloadCollage, renderCollageBlob } from "./collageExport"
import type { ExportFormat } from "./collageExport"
import { resolveCollage } from "./collageStore"
import type { CollagesStatus, SavedCollage } from "./collageStore"
import "../styles/styles.css"

type PhotoStatus = "loading" | "ready" | "error"

export function AlbumPreview({
  album,
  photos,
  collages = [],
  collagesStatus = "ready",
  photoStatus = "ready",
  onRetryCollages,
  onRetryPhotos,
}: {
  album: Album
  photos: Photo[]
  collages?: SavedCollage[]
  collagesStatus?: CollagesStatus
  photoStatus?: PhotoStatus
  onRetryCollages?: () => void
  onRetryPhotos?: () => void
}) {
  const albumCollages = collages.filter((collage) => collage.albumId === album.id)

  return (
    <div className="album-preview-wrap">
      <a className="back" href={"#/albums/" + encodeURIComponent(album.id)}>
        Back to album
      </a>
      <article className="album-preview" aria-label="Album preview">
        <h2>{album.title}</h2>
        {photoStatus === "loading" ? (
          <p role="status">Loading album photos…</p>
        ) : photoStatus === "error" ? (
          <p role="alert">
            Couldn’t load album photos, so saved layouts can’t be previewed or exported.
            {onRetryPhotos && <> <button type="button" onClick={onRetryPhotos}>Retry photos</button></>}
          </p>
        ) : collagesStatus === "loading" ? (
          <p role="status">Loading saved collages…</p>
        ) : collagesStatus === "error" ? (
          <>
            <p role="alert">
              Couldn’t load saved collages. The photo list below is not an exportable collage.
              {onRetryCollages && <> <button type="button" onClick={onRetryCollages}>Retry saved collages</button></>}
            </p>
            <AlbumPhotoList photos={photos} />
          </>
        ) : albumCollages.length > 0 ? (
          <div className="album-preview-collages">
            {albumCollages.map((collage) => (
              <SavedCollagePreview key={`${collage.id}:${collage.updatedAt}`} collage={collage} photos={photos} />
            ))}
          </div>
        ) : (
          <>
            <p className="album-preview-note">
              No saved collages yet. Showing album photos only; save a collage to preview and export its layout.
            </p>
            <AlbumPhotoList photos={photos} />
          </>
        )}
      </article>
    </div>
  )
}

function AlbumPhotoList({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return <p>No photos to preview yet.</p>
  return (
    <ul className="album-preview-photos">
      {photos.map((photo) => (
        <li key={photo.id}>
          <img src={photo.src} alt={photo.title || "Photo"} loading="lazy" />
        </li>
      ))}
    </ul>
  )
}

function SavedCollagePreview({ collage, photos }: { collage: SavedCollage; photos: Photo[] }) {
  const formatId = useId()
  const stageRef = useRef<HTMLDivElement>(null)
  const [format, setFormat] = useState<ExportFormat>("png")
  const [imageStates, setImageStates] = useState<Record<string, "loaded" | "error">>({})
  const [imageAttempt, setImageAttempt] = useState(0)
  const imageAttemptRef = useRef(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [downloadMessage, setDownloadMessage] = useState("")
  const { template, slots, missing } = resolveCollage(collage, photos)
  const imagesReady = slots.every((photo) => photo !== undefined && imageStates[photo.src] === "loaded")
  const imageError = slots.some((photo) => photo !== undefined && imageStates[photo.src] === "error")
  const canExport = Boolean(template) && missing === 0 && imagesReady && !exporting

  const onImageStatus = useCallback((status: "loaded" | "error", src: string) => {
    if (imageAttemptRef.current !== imageAttempt) return
    setImageStates((previous) => previous[src] === status ? previous : { ...previous, [src]: status })
  }, [imageAttempt])

  const retryImages = () => {
    imageAttemptRef.current += 1
    setImageStates({})
    setImageAttempt((attempt) => attempt + 1)
    setExportError(null)
    setDownloadMessage("")
  }

  const exportCollage = async () => {
    if (!canExport || !template || missing > 0 || !stageRef.current) return
    setExporting(true)
    setExportError(null)
    setDownloadMessage("")
    try {
      const blob = await renderCollageBlob(template, slots as Photo[], stageRef.current, format)
      setDownloadMessage(`Downloaded ${downloadCollage(blob, collage.name, format)}`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Couldn’t export this collage. Check the image files and try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="album-collage-preview" aria-label={`Saved collage ${collage.name}`}>
      <h3>{collage.name}</h3>
      {!template ? (
        <p role="alert" className="album-preview-error">
          This saved collage layout is no longer available, so it can’t be previewed or exported.
        </p>
      ) : (
        <>
          <div ref={stageRef} className="ac-stage ac-stage--readonly" aria-label={`Collage preview: ${collage.name}`}>
            <CollageLayout
              key={imageAttempt}
              template={template}
              photos={slots}
              onImageStatus={onImageStatus}
            />
          </div>

          {missing > 0 && (
            <p role="alert" className="album-preview-error">
              {missing} {missing === 1 ? "saved photo is" : "saved photos are"} no longer in this album. The empty slots can’t be exported.
            </p>
          )}
          {imageError && (
            <p role="alert" className="album-preview-error">
              One or more collage photos couldn’t be loaded. Export is disabled. Check the image server or retry.
              <button type="button" onClick={retryImages}>Retry photos</button>
            </p>
          )}
          {!imageError && missing === 0 && !imagesReady && (
            <p role="status">Loading collage photos before export is available…</p>
          )}

          <div className="album-export-controls">
            <label htmlFor={formatId}>File format</label>
            <select id={formatId} value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} disabled={exporting}>
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
            <button type="button" onClick={exportCollage} disabled={!canExport}>
              {exporting ? "Preparing…" : `Download ${format.toUpperCase()}`}
            </button>
          </div>
          {exportError && <p role="alert" className="album-preview-error">{exportError}</p>}
          {downloadMessage && <p role="status">{downloadMessage}</p>}
        </>
      )}
    </section>
  )
}
