import type { Album, Photo } from "./api.ts"

// Read-only: the page is what the export will render (US #22). No links, buttons or inputs inside it.
export function AlbumPreview({ album, photos }: { album: Album; photos: Photo[] }) {
  return (
    <div className="album-preview-wrap">
      <a className="back" href={"#/albums/" + encodeURIComponent(album.id)}>
        Back to album
      </a>
      <article className="album-preview" aria-label="Album preview">
        <h2>{album.title}</h2>
        {photos.length === 0 ? (
          <p>No photos to preview yet.</p>
        ) : (
          <ul className="album-preview-photos">
            {photos.map((photo) => (
              <li key={photo.id}>
                <img src={photo.src} alt={photo.title || "Photo"} loading="lazy" />
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  )
}
