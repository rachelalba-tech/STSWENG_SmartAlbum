import type { Album, Photo } from "./api.ts"
import { PhotoGallery } from "./PhotoGallery.tsx"

export function AlbumPage({ album, photos = [] }: { album: Album; photos?: Photo[] }) {
  return (
    <article className="album album--gallery">
      <a className="back" href="#/">
        All albums
      </a>
      <a
        className="album-preview-link"
        href={`#/albums/${encodeURIComponent(album.id)}/preview`}
      >
        Preview album
      </a>
      <PhotoGallery
        photos={photos}
        title={album.title}
        subtitle={`${photos.length} photo${photos.length === 1 ? "" : "s"} in this album`}
        emptyTitle="No photos in this album"
        emptyDescription="Upload photos to this album and they will appear here."
      />
    </article>
  )
}
