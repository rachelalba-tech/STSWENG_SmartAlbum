import { useState } from "react"
import { fetchDuplicateGroups, removeDuplicatePhotos, removeDuplicatePhoto } from "./api.ts"
import type { DuplicateGroup } from "./api.ts"
import "../styles/DuplicatePhotos.css"

export function DuplicatePhotos({
  albumId,
  onPhotosChanged = () => {},
}: {
  albumId?: string
  onPhotosChanged?: () => void | Promise<void>
}) {
  const [visible, setVisible] = useState(false)
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [keptIds, setKeptIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("")

  const extras = groups?.flatMap((group) => group.duplicates) ?? []
  const pendingIds = extras.filter((photo) => !keptIds.has(photo.id)).map((photo) => photo.id)

  async function scan(reloadPhotos = false) {
    setVisible(true)
    setLoading(true)
    setError(null)
    setConfirming(false)
    try {
      if (reloadPhotos) await onPhotosChanged()
      const next = await fetchDuplicateGroups(albumId)
      setGroups(next)
      const ids = new Set(next.flatMap((group) => group.duplicates.map((photo) => photo.id)))
      setKeptIds((current) => new Set([...current].filter((id) => ids.has(id))))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find duplicate photos")
    } finally {
      setLoading(false)
    }
  }

  async function removeOne(photoId: string) {
    setBusy(true)
    setError(null)
    try {
      await removeDuplicatePhoto(photoId, albumId)
      setKeptIds((current) => {
        const next = new Set(current)
        next.delete(photoId)
        return next
      })
      setStatus(albumId ? "Duplicate removed from this album." : "Duplicate removed from your library.")
      await scan(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove duplicate photo")
    } finally {
      setBusy(false)
    }
  }

  async function removeExtras() {
    const removingIds = [...pendingIds]
    if (removingIds.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await removeDuplicatePhotos(albumId, removingIds)
      setStatus(albumId ? "Duplicate extras removed from this album." : "Duplicate extras removed from your library.")
      setKeptIds(new Set())
      await scan(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove duplicate photos")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dp" aria-label="Duplicate photos">
      <div className="dp-actions">
        <button type="button" className="dp-button" onClick={() => scan()} disabled={loading || busy}>
          {loading ? "Finding duplicates…" : groups === null ? "Find duplicate photos" : "Rescan duplicates"}
        </button>
        {groups && groups.length > 0 && (
          <button
            type="button"
            className="dp-button dp-button--danger"
            onClick={() => setConfirming(true)}
            disabled={loading || busy || pendingIds.length === 0}
          >
            Delete all extras ({pendingIds.length})
          </button>
        )}
      </div>

      <p className="dp-scope">
        Exact duplicates are byte-identical files. {albumId
          ? "Removing a copy here only detaches it from this album; it stays in your library."
          : "Removing a copy here removes its photo record from the library and its album."} Stored bytes are removed only when no remaining photo record references them; cleanup can leave unreferenced bytes on disk.
      </p>

      {status && <p className="dp-status" role="status">{status}</p>}
      {error && (
        <p className="dp-error" role="alert">
          {error} <button type="button" onClick={() => scan(true)} disabled={loading || busy}>Retry</button>
        </p>
      )}
      {confirming && (
        <div className="dp-confirm" role="group" aria-label="Confirm duplicate deletion">
          <p>Delete {pendingIds.length} duplicate {pendingIds.length === 1 ? "photo" : "photos"}? Kept copies and each group’s original will remain.</p>
          <button type="button" className="dp-button dp-button--danger" onClick={removeExtras} disabled={loading || busy || pendingIds.length === 0}>
            Confirm delete all extras
          </button>
          <button type="button" className="dp-button" onClick={() => setConfirming(false)} disabled={loading || busy}>Cancel</button>
        </div>
      )}

      {visible && !loading && groups && (groups.length === 0 ? (
        <p className="dp-empty">No exact duplicate photos found.</p>
      ) : (
        <div className="dp-groups">
          {groups.map((group) => (
            <article className="dp-group" key={group.keeper.id}>
              <div className="dp-photo">
                <a href={group.keeper.src} target="_blank" rel="noreferrer" aria-label={`View full-size original ${group.keeper.title || "photo"}`}>
                  <img src={group.keeper.thumbnail} alt={group.keeper.title || "Original photo"} />
                </a>
                <span>{group.keeper.title || "Original photo"} · Original kept</span>
              </div>
              {group.duplicates.map((photo) => {
                const kept = keptIds.has(photo.id)
                return (
                  <div className="dp-photo" key={photo.id}>
                    <a href={photo.src} target="_blank" rel="noreferrer" aria-label={`View full-size ${photo.title || "duplicate photo"}`}>
                      <img src={photo.thumbnail} alt={photo.title || "Duplicate photo"} />
                    </a>
                    <span>{photo.title || "Duplicate photo"}</span>
                    <div className="dp-photo-actions">
                      {kept ? (
                        <button type="button" onClick={() => setKeptIds((current) => {
                          const next = new Set(current)
                          next.delete(photo.id)
                          return next
                        })} disabled={busy}>Undo keep</button>
                      ) : (
                        <button type="button" onClick={() => setKeptIds((current) => new Set(current).add(photo.id))} disabled={busy}>
                          Keep this copy
                        </button>
                      )}
                      {!kept && <button type="button" className="dp-delete" onClick={() => removeOne(photo.id)} disabled={busy}>Delete duplicate</button>}
                      {kept && <span className="dp-kept">Kept</span>}
                    </div>
                  </div>
                )
              })}
            </article>
          ))}
        </div>
      ))}
    </section>
  )
}
