import { useState } from "react"
import { AlbumCollage, CollageLayout } from "./AlbumCollage"
import type { SaveHandler } from "./AlbumCollage"
import { resolveCollage } from "./collageStore"
import type { SavedCollage } from "./collageStore"  
import type { ManagedAlbum, Photo } from "./AlbumManager"
import "../styles/AlbumCollage.css"

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { dateStyle: "medium" })
}

interface PanelProps {
  album: ManagedAlbum
  photos: Photo[]
  collages: SavedCollage[]
  onSave?: SaveHandler
  onDelete?: (id: string) => void
  onClose?: () => void
}

type Mode = { kind: "list" } | { kind: "view"; id: string } | { kind: "edit"; id: string }

export function SavedCollagesPanel({ album, photos, collages, onSave, onDelete, onClose }: PanelProps) {
  const [mode, setMode] = useState<Mode>({ kind: "list" })
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const mine = collages
    .filter((c) => c.albumId === album.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const current = mode.kind === "list" ? undefined : mine.find((c) => c.id === mode.id)

  if (mode.kind === "list" || !current) {
    return (
      <div className="sc">
        {mine.length === 0 ? (
          <p className="am-muted sc-empty">
            No saved collages yet. Use “Create collage” on this album to make one.
          </p>
        ) : (
          <ul className="sc-grid">
            {mine.map((c) => {
              const { template, slots, missing } = resolveCollage(c, photos)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="sc-card"
                    aria-label={`Open collage ${c.name}`}
                    onClick={() => setMode({ kind: "view", id: c.id })}
                  >
                    <span className="sc-preview">
                      {template ? (
                        <CollageLayout
                          template={template}
                          photos={slots.map((p) => (p ? { ...p, src: p.thumbnail } : undefined))}
                        />
                      ) : (
                        <span className="sc-unavailable am-muted">Layout unavailable</span>
                      )}
                    </span>
                    <span className="sc-name">{c.name}</span>
                    <span className="sc-meta am-muted">
                      {formatDate(c.updatedAt)}
                      {missing > 0 && " · photos missing"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <a className="sc-preview-link" href={`#/albums/${encodeURIComponent(album.id)}/preview`}>
          Preview and export album collages
        </a>
        <div className="am-dialog-actions">
          {onClose && <button className="am-btn am-btn--outline" onClick={onClose}>Close</button>}
        </div>
      </div>
    )
  }

  const { template, slots, missing } = resolveCollage(current, photos)

  if (mode.kind === "edit" && template && missing === 0 && onSave) {
    const saved = slots as Photo[]
    return (
      <AlbumCollage
        photos={saved}
        initial={{ id: current.id, name: current.name, templateId: current.templateId, order: saved }}
        onSave={onSave}
        onClose={() => setMode({ kind: "view", id: current.id })}
      />
    )
  }

  const canEdit = Boolean(onSave) && Boolean(template) && missing === 0

  return (
    <div className="sc">
      <h3 className="sc-title">{current.name}</h3>
      <p className="am-muted sc-meta">Saved {formatDate(current.updatedAt)}</p>

      {!template && (
        <p role="alert" className="sc-warning">
          This collage's layout is no longer available, so it can't be displayed.
        </p>
      )}
      {template && missing > 0 && (
        <p role="alert" className="sc-warning">
          {missing} {missing === 1 ? "photo is" : "photos are"} no longer in this album, so
          {missing === 1 ? " its slot is" : " their slots are"} empty.
        </p>
      )}

      {template && (
        <div className="ac-stage ac-stage--readonly" aria-label={`Collage ${current.name}`}>
          <CollageLayout template={template} photos={slots} />
        </div>
      )}

      <a className="sc-preview-link" href={`#/albums/${encodeURIComponent(album.id)}/preview`}>
        Preview and export album collages
      </a>
      <div className="am-dialog-actions">
        <button className="am-btn am-btn--outline" onClick={() => { setConfirmingDelete(false); setMode({ kind: "list" }) }}>
          Back
        </button>
        {onDelete && !confirmingDelete && (
          <button className="am-btn am-btn--outline" onClick={() => setConfirmingDelete(true)}>Delete</button>
        )}
        {onDelete && confirmingDelete && (
          <button
            className="am-btn am-btn--danger"
            onClick={() => {
              onDelete(current.id)
              setConfirmingDelete(false)
              setMode({ kind: "list" })
            }}
          >
            Confirm delete
          </button>
        )}
        {onSave && (
          <button className="am-btn am-btn--primary" disabled={!canEdit} onClick={() => setMode({ kind: "edit", id: current.id })}>
            Edit
          </button>
        )}
      </div>
    </div>
  )
}
