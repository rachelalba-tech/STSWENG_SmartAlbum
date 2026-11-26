import { useState } from "react"
import type { Album, Photo } from "./api.ts"
import { DuplicatePhotos } from "./DuplicatePhotos.tsx"
import { PhotoGallery } from "./PhotoGallery.tsx"

export function AlbumPage({ album, photos = [], library, onRemove, onUpdate, onReorder, onAdd, onPhotosChanged }: {
  album: Album
  photos?: Photo[]
  library?: Photo[] | null
  onRemove?: (photoId: string) => void | Promise<void>
  onUpdate?: (title: string, description: string) => Promise<void>
  onReorder?: (ids: string[]) => Promise<void>
  onAdd?: (ids: string[]) => Promise<void>
  onPhotosChanged?: () => void | Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(album.title)
  const [description, setDescription] = useState(album.description ?? "")
  const [order, setOrder] = useState<string[] | null>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const displayed = order ? order.map((id) => photos.find((p) => p.id === id)!).filter(Boolean) : photos
  const available = (library ?? []).filter((p) => !photos.some((current) => current.src === p.src))

  const hasTools =
    (!!onUpdate && !editing) || !!onAdd || (!!onReorder && photos.length > 1 && !order) || (!!order && !!onReorder)

  async function save(action: () => Promise<void>, finish: () => void) {
    if (busy) return
    setBusy(true)
    setError(null)
    try { await action(); finish() } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes")
    } finally { setBusy(false) }
  }

  function move(id: string, target: number) {
    if (!order || busy || target < 0 || target >= order.length) return
    const next = order.filter((value) => value !== id)
    next.splice(target, 0, id)
    setOrder(next)
  }

  return (
    <article className="album">
      <div className="album-nav">
        <a className="back" href="#/">All albums</a>
        <a href={`#/albums/${encodeURIComponent(album.id)}/preview`}>Preview and export album</a>
      </div>
      <h2>{album.title}</h2>
      {album.description && <p>{album.description}</p>}
      <DuplicatePhotos albumId={album.id} onPhotosChanged={onPhotosChanged} />
      {error && <p role="alert">{error}</p>}
      {hasTools && <div className="album-toolbar" role="toolbar" aria-label="Album options">
        {onUpdate && !editing && <button type="button" onClick={() => {
          setTitle(album.title); setDescription(album.description ?? ""); setEditing(true)
        }}>Edit album details</button>}
        {onAdd && <button type="button" aria-expanded={adding} disabled={busy || !library || !!order} onClick={() => { setSelected([]); setAdding(!adding) }}>Add photos from library</button>}
        {onReorder && photos.length > 1 && !order && <button type="button" disabled={busy || adding} onClick={() => setOrder(photos.map((p) => p.id))}>Edit photo order</button>}
        {order && onReorder && <>
          <button type="button" disabled={busy} onClick={() => void save(() => onReorder(order), () => setOrder(null))}>Save photo order</button>
          <button type="button" disabled={busy} onClick={() => setOrder(null)}>Cancel order</button>
        </>}
      </div>}
      {editing && onUpdate && <form onSubmit={(e) => {
        e.preventDefault()
        void save(() => onUpdate(title.trim(), description.trim()), () => setEditing(false))
      }}>
        <label>Headline <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={busy} /></label>
        <label>Description <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} disabled={busy} /></label>
        <button disabled={busy || !title.trim()}>Save details</button>
        <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel details</button>
      </form>}
      {adding && onAdd && <fieldset disabled={busy}>
        <legend>Choose photos to add</legend>
        {available.length === 0 && <p>No more photos available.</p>}
        {available.map((p) => <label key={p.id} style={{ display: "block" }}>
          <input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected((prev) =>
            e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id))} /> {p.title || "Photo"}
        </label>)}
        <button disabled={!selected.length} onClick={() => void save(() => onAdd(selected), () => setAdding(false))}>Add selected photos</button>
        <button onClick={() => setAdding(false)}>Cancel adding</button>
      </fieldset>}
      {order && onReorder && <p>Drag photos, or use Move earlier / Move later, then save.</p>}
      {!order ? <PhotoGallery photos={photos} title="Album photos" subtitle={`${photos.length} photos in this album`}
        emptyTitle="No photos in this album" emptyDescription="Upload photos to this album and they will appear here."
        busy={busy} onRemove={onRemove ? (id) => void save(async () => { await onRemove(id) }, () => {}) : undefined} />
      : <ul className="photos" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {displayed.map((photo, index) => <li key={photo.id} draggable={!!order && !busy}
          onDragStart={() => setDragged(photo.id)} onDragEnd={() => setDragged(null)}
          onDragOver={(e) => { if (order) e.preventDefault() }}
          onDrop={(e) => { e.preventDefault(); if (dragged) move(dragged, index); setDragged(null) }}>
          <a href={photo.src} target="_blank" rel="noreferrer">
            <img src={photo.thumbnail} alt={photo.title || "Photo"} width={160} height={160} loading="lazy" style={{ objectFit: "cover" }} />
          </a>
          {order ? <>
            <button disabled={busy || index === 0} aria-label={`Move ${photo.title || "photo"} earlier`} onClick={() => move(photo.id, index - 1)}>Move earlier</button>
            <button disabled={busy || index === displayed.length - 1} aria-label={`Move ${photo.title || "photo"} later`} onClick={() => move(photo.id, index + 1)}>Move later</button>
          </> : onRemove && <button type="button" disabled={busy} onClick={() => void save(async () => { await onRemove(photo.id) }, () => {})}>Remove {photo.title || "photo"} from album</button>}
        </li>)}
      </ul>}
    </article>
  )
}
