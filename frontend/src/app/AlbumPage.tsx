import type { Album, Photo } from "./api.ts"
import { DuplicatePhotos } from "./DuplicatePhotos.tsx"

// Added conditions for albums with no photos 
export function AlbumPage({
  album,
  photos = [],
  onRemove,
  onPhotosChanged,
}: {
  album: Album
  photos?: Photo[]
  onRemove?: (photoId: string) => void
  onPhotosChanged?: () => void | Promise<void>
}) {
  return (
    <article className="album">
      <a className="back" href="#/">
        All albums
      </a>
      <a href={"#/albums/" + encodeURIComponent(album.id) + "/preview"} style={{ display: "block", marginBottom: 16 }}>
        Preview album
      </a>
      <h2>{album.title}</h2>
      <DuplicatePhotos albumId={album.id} onPhotosChanged={onPhotosChanged} />
      {photos.length === 0 ? (
        <p>No photos yet.</p>
      ) : (
        <ul className="photos" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {photos.map((photo) => (
            <li key={photo.id}>
              <a href={photo.src} target="_blank" rel="noreferrer">
                <img src={photo.thumbnail} alt={photo.title || "Photo"} width={160} height={160} loading="lazy" style={{ objectFit: "cover" }} />
              </a>
              {onRemove && (
                <button type="button" onClick={() => onRemove(photo.id)}>
                  Remove {photo.title || "photo"} from album
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
