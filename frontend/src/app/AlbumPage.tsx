import type { Album, Photo } from "./api.ts"

// Added conditions for albums with no photos 
export function AlbumPage({ album, photos = [] }: { album: Album; photos?: Photo[] }) {
  return (
    <article className="album">
      <a className="back" href="#/">
        All albums
      </a>
      <h2>{album.title}</h2>
      {photos.length === 0 ? (
        <p>No photos yet.</p>
      ) : (
        <ul className="photos" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {photos.map((photo) => (
            <li key={photo.id}>
              <a href={photo.src} target="_blank" rel="noreferrer">
                <img src={photo.thumbnail} alt={photo.title || "Photo"} width={160} height={160} loading="lazy" style={{ objectFit: "cover" }} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}