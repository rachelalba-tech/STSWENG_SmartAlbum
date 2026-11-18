import { useEffect, useState } from "react"
import "../styles/App.css"
import "../styles/AppShell.css"
import { fetchAlbum, fetchAlbums, fetchPhotos, removePhotoFromAlbum } from "./api.ts"
import type { Album, Photo } from "./api.ts"
import { AlbumPage } from "./AlbumPage.tsx"
import { AlbumPreview } from "./AlbumPreview.tsx"
import { AppTabs } from "./AppTabs.tsx"
import { PhotoUpload } from "./PhotoUpload.tsx"
import { PhotoGallery } from "./PhotoGallery.tsx"
import { albumIdFromHash, pageFromHash, previewAlbumIdFromHash } from "./route.ts"
import { AlbumManager } from "./AlbumManager.tsx"
import type { ManagedAlbum } from "./AlbumManager.tsx"
import { useCollages } from "./useCollages.ts"

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return hash
}

const toManaged = (a: Album): ManagedAlbum => ({
  id: a.id,
  name: a.title,
  description: "",
  collaborationEnabled: false,
  collaborators: [],
})

function AlbumListRoute() {
  const [albums, setAlbums] = useState<ManagedAlbum[] | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [error, setError] = useState<string | null>(null)
  const { collages, status, reload, save, remove } = useCollages()

  useEffect(() => {
    let active = true
    // Photo counts and covers are a nice-to-have, so a failure here must not hide the albums.
    fetchPhotos().then(
      (next) => {
        if (active) setPhotos(next)
      },
      () => {},
    )
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
    <>
      {status === "error" && (
        <p role="alert">
          Couldn't load saved collages. <button onClick={reload}>Retry</button>
        </p>
      )}
      <AlbumManager
        albums={albums}
        photos={photos}
        collages={collages}
        onCollageSave={save}
        onCollageDelete={remove}
        onAlbumCreate={(a) => setAlbums((prev) => [...(prev ?? []), a])}
        onAlbumUpdate={(a) => setAlbums((prev) => (prev ?? []).map((x) => (x.id === a.id ? a : x)))}
        onAlbumSelect={(id) => {
          window.location.hash = id ? `#/albums/${encodeURIComponent(id)}` : "#/"
        }}
      />
    </>
  )
}

function AlbumRoute({ id, preview = false }: { id: string; preview?: boolean }) {
  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
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

  useEffect(() => {
    let active = true
    setPhotos([])
    setPhotoError(null)
    fetchPhotos(id).then(
      (next) => {
        if (active) setPhotos(next)
      },
      () => {
        if (active) setPhotoError("Could not load photos.")
      },
    )
    return () => {
      active = false
    }
  }, [id])

  async function removePhoto(photoId: string) {
    try {
      await removePhotoFromAlbum(id, photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      setPhotoError(null)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not remove photo")
    }
  }

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
  return (
    <>
      {preview ? <AlbumPreview album={album} photos={photos} /> : <AlbumPage album={album} photos={photos} onRemove={removePhoto} />}
      {photoError && <p>{photoError}</p>}
    </>
  )
}

function UploadRoute() {
  const [albums, setAlbums] = useState<Album[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastAlbumId, setLastAlbumId] = useState<string | null>(null)

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
  if (albums.length === 0) {
    return (
      <div className="page">
        <h2>Upload Photos</h2>
        <p>
          Photos are stored in albums. <a href="#/">Create an album</a> first.
        </p>
      </div>
    )
  }
  return (
    <div className="page">
      <PhotoUpload
        albums={albums.map((a) => ({ id: a.id, name: a.title }))}
        onUploaded={(added) => setLastAlbumId(added[0].albumId)}
      />
      {lastAlbumId && (
        <p>
          <a href={`#/albums/${encodeURIComponent(lastAlbumId)}`}>View the album</a>
        </p>
      )}
    </div>
  )
}

function PhotosRoute() {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchPhotos().then(
      (next) => {
        if (active) setPhotos(next)
      },
      () => {
        if (active) setError("Could not load photos. Start the server with npm start in server/.")
      },
    )
    return () => {
      active = false
    }
  }, [])

  if (error) return <p>{error}</p>
  if (!photos) return <p>Loading photos…</p>
  return <PhotoGallery photos={photos} />
}

export default function App() {
  const hash = useHash()
  const albumId = albumIdFromHash(hash)
  const previewId = previewAlbumIdFromHash(hash)
  const page = albumId || previewId ? "albums" : pageFromHash(hash)

  return (
    <section id="center">
      <header className="app-header">
        <h1>Smart Photo Album</h1>
      </header>
      <AppTabs active={page} />
      {previewId ? (
        // Keyed so switching between album and preview of the same id refetches and remounts.
        <AlbumRoute key={"preview:" + previewId} id={previewId} preview />
      ) : albumId ? (
        <AlbumRoute id={albumId} />
      ) : page === "upload" ? (
        <UploadRoute />
      ) : page === "photos" ? (
        <PhotosRoute />
      ) : (
        <AlbumListRoute />
      )}
    </section>
  )
}