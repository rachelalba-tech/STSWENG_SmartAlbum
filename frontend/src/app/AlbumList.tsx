import type { Album } from "./api.ts"

export function AlbumList({ albums }: { albums: Album[] }) {
  if (albums.length === 0) {
    return <p>No albums yet.</p>
  }

  return (
    <ul className="albums">
      {albums.map((album) => (
        <li key={album.id}>
          <a href={`#/albums/${encodeURIComponent(album.id)}`}>{album.title}</a>
        </li>
      ))}
    </ul>
  )
}
