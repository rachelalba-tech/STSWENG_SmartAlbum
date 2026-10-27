import type { Album } from "./api.ts"

export function AlbumPage({ album }: { album: Album }) {
  return (
    <article className="album">
      <a className="back" href="#/">
        All albums
      </a>
      <h2>{album.title}</h2>
    </article>
  )
}
