import { useEffect, useState } from "react"
import "../styles/App.css"
import "../styles/AppShell.css"
import { addPhotosToAlbum, createAlbum, deleteAlbum, fetchAlbum, fetchAlbums, fetchPhotos, fetchSession, logout, removePhotoFromAlbum, reorderAlbumPhotos, updateAlbum } from "./api.ts"
import type { Album, Photo, User } from "./api.ts"
import { LoginPage } from "./LoginPage.tsx"
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
  description: a.description ?? "",
  collaborationEnabled: false,
  collaborators: [],
})

function AlbumListRoute({ canLabel }: { canLabel: boolean }) {
  const [albums, setAlbums] = useState<ManagedAlbum[] | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [error, setError] = useState<string | null>(null)
  const { collages, status, reload, save, remove } = useCollages()

  useEffect(() => {
    let active = true
    fetchAlbums().then(
      (next) => {
        if (active) setAlbums(next.map(toManaged))
        // Collages/counts need every album membership, not the deduplicated library.
        Promise.all(next.map((album) => fetchPhotos(album.id))).then(
          (members) => { if (active) setPhotos(members.flat()) },
          () => {},
        )
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
        canLabel={canLabel}
        albums={albums}
        photos={photos}
        collages={collages}
        onCollageSave={save}
        onCollageDelete={remove}
        onAlbumCreate={async (a) => {
          const saved = await createAlbum(a.name, a.description)
          setAlbums((prev) => [...(prev ?? []), toManaged(saved)])
        }}
        onAlbumUpdate={async (a) => {
          const current = albums.find((x) => x.id === a.id)
          if (current?.name !== a.name || current?.description !== a.description) {
            const saved = await updateAlbum(a.id, a.name, a.description)
            a = { ...a, name: saved.title, description: saved.description ?? "" }
          }
          setAlbums((prev) => (prev ?? []).map((x) => x.id === a.id ? a : x))
        }}
        onAlbumDelete={async (id) => {
          await deleteAlbum(id)
          setAlbums((prev) => (prev ?? []).filter((a) => a.id !== id))
          setPhotos((prev) => prev.map((p) => p.albumId === id ? { ...p, albumId: "" } : p))
          reload()
        }}
        onAlbumSelect={(id) => {
          window.location.hash = id ? `#/albums/${encodeURIComponent(id)}` : "#/"
        }}
      />
    </>
  )
}

function AlbumRoute({ id, preview = false, canLabel }: { id: string; preview?: boolean; canLabel: boolean }) {
  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [library, setLibrary] = useState<Photo[] | null>(null)
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

  useEffect(() => {
    let active = true
    fetchPhotos().then((next) => { if (active) setLibrary(next) }, () => {
      if (active) setPhotoError("Could not load the photo library.")
    })
    return () => { active = false }
  }, [])

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
      {preview ? <AlbumPreview album={album} photos={photos} /> : <AlbumPage
        album={album} photos={photos} library={library} onRemove={removePhoto}
        onUpdate={canLabel ? async (title, description) => setAlbum(await updateAlbum(id, title, description)) : undefined}
        onReorder={async (ids) => setPhotos(await reorderAlbumPhotos(id, ids))}
        onAdd={async (ids) => setPhotos(await addPhotosToAlbum(id, ids))}
      />}
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
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const expired = () => { if (active) setCurrentUser(null) }
    window.addEventListener("session-expired", expired)
    fetchSession().then((user) => { if (active) setCurrentUser(user) }, () => {
      if (active) setAccountError("Could not check your session. Check the API connection and retry.")
    })
    return () => { active = false; window.removeEventListener("session-expired", expired) }
  }, [attempt])
  const hash = useHash()
  const albumId = albumIdFromHash(hash)
  const previewId = previewAlbumIdFromHash(hash)
  const page = albumId || previewId ? "albums" : pageFromHash(hash)

  if (currentUser === undefined) return accountError ? <p role="alert">{accountError} <button onClick={() => {
    setAccountError(null); setAttempt((n) => n + 1)
  }}>Retry</button></p> : <p>Checking session…</p>
  if (!currentUser) return <LoginPage onLogin={(user) => { setAccountError(null); setCurrentUser(user) }} />

  return (
    <section id="center">
      <header className="app-header">
        <h1>Smart Photo Album</h1>
        <div className="app-account">
          <span>{currentUser.username}</span>
          <button disabled={loggingOut} onClick={async () => {
            setLoggingOut(true); setAccountError(null)
            try { await logout(); setCurrentUser(null) } catch (err) {
              setAccountError(err instanceof Error ? err.message : "Could not log out")
            } finally { setLoggingOut(false) }
          }}>Log out</button>
        </div>
      </header>
      {accountError && <p role="alert">{accountError}</p>}
      <AppTabs active={page} />
      {previewId ? (
        // Keyed so switching between album and preview of the same id refetches and remounts.
        <AlbumRoute key={"preview:" + previewId} id={previewId} preview canLabel={currentUser.role === "admin"} />
      ) : albumId ? (
        <AlbumRoute key={albumId} id={albumId} canLabel={currentUser.role === "admin"} />
      ) : page === "upload" ? (
        <UploadRoute />
      ) : page === "photos" ? (
        <PhotosRoute />
      ) : (
        <AlbumListRoute canLabel={currentUser.role === "admin"} />
      )}
    </section>
  )
}
