import { useEffect, useState } from "react"
import "../styles/App.css"
import { fetchAlbum, fetchAlbums } from "./api.ts"
import type { Album } from "./api.ts"
import { AlbumList } from "./AlbumList.tsx"
import { AlbumPage } from "./AlbumPage.tsx"
import { albumIdFromHash } from "./route.ts"
import { AlbumManager } from "./AlbumManager.tsx"
import type { ManagedAlbum } from "./AlbumManager.tsx" 

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return hash
}
// Your API albums only have id/title/ownerId, so fill in the rest
const toManaged = (a: Album): ManagedAlbum => ({
  id: a.id,
  name: a.title,
  description: "",
  collaborationEnabled: false,
  collaborators: [],
})

function AlbumListRoute() {
  const [albums, setAlbums] = useState<ManagedAlbum[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchAlbums().then(
      (next) => {
        if (active) setAlbums(next.map(toManaged))
      },
      () => {
        if (active) setError("Could not load albums. Start the server with npm start in server/.")
      },
    )
    return () => {
      active = false
    }
  }, [])

  if (error) return <p>{error}</p>
  if (!albums) return <p>Loading albums…</p>
  return (
    <AlbumManager
      albums={albums}
      photos={[]}
      onAlbumCreate={(a) => setAlbums((prev) => [...(prev ?? []), a])}
      onAlbumUpdate={(a) => setAlbums((prev) => (prev ?? []).map((x) => (x.id === a.id ? a : x)))}
      onAlbumSelect={(id) => {
        window.location.hash = id ? `#/albums/${encodeURIComponent(id)}` : "#/"
      }}
    />
  )
}

function AlbumRoute({ id }: { id: string }) {
  const [album, setAlbum] = useState<Album | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchAlbum(id).then(
      (next) => {
        if (active) setAlbum(next)
      },
      (err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not open album")
      },
    )
    return () => {
      active = false
    }
  }, [id])

  if (error) {
    return (
      <>
        <a className="back" href="#/">
          All albums
        </a>
        <p>{error}</p>
      </>
    )
  }
  if (!album) return <p>Loading album…</p>
  return <AlbumPage album={album} />
}

export default function App() {
  const albumId = albumIdFromHash(useHash())
  return (
    <section id="center">
      <h1>Smart Photo Album</h1>
      {albumId ? <AlbumRoute id={albumId} /> : <AlbumListRoute />}
    </section>
  )
}
