import { useEffect, useState } from "react"
import "../styles/App.css"
import { fetchAlbum, fetchAlbums } from "./api.ts"
import type { Album } from "./api.ts"
import { AlbumList } from "./AlbumList.tsx"
import { AlbumPage } from "./AlbumPage.tsx"
import { albumIdFromHash } from "./route.ts"

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return hash
}

function AlbumListRoute() {
  const [albums, setAlbums] = useState<Album[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchAlbums().then(
      (next) => {
        if (active) setAlbums(next)
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
    <>
      <h2>Your albums</h2>
      <AlbumList albums={albums} />
    </>
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
