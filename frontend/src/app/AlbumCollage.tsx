import { useId, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { templatesFor, supportedCounts } from "./collageTemplates"
import type { CollageTemplate } from "./collageTemplates"
import type { CollageDraft, SavedCollage } from "./collageStore"
import type { Photo } from "./AlbumManager"
import "../styles/AlbumCollage.css"

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? "s" : ""}`

interface LayoutProps {
  template: CollageTemplate
  photos?: (Photo | undefined)[]
  pickedIndex?: number | null
  onSlotClick?: (index: number) => void
  onSwap?: (from: number, to: number) => void
}

export function CollageLayout({ template, photos, pickedIndex, onSlotClick, onSwap }: LayoutProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const editable = Boolean(onSlotClick)

  return (
    <div
      className="ac-layout"
      style={{
        gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
        gridTemplateRows: `repeat(${template.rows}, 1fr)`,
      }}
    >
      {template.cells.map((c, i) => {
        const photo = photos?.[i]
        const style: CSSProperties = {
          gridColumn: `${c.col} / span ${c.colSpan ?? 1}`,
          gridRow: `${c.row} / span ${c.rowSpan ?? 1}`,
        }
        const cls = `ac-slot${pickedIndex === i ? " is-picked" : ""}${dragFrom === i ? " is-dragging" : ""}`

        if (!editable) {
          return (
            <div key={i} className={cls} style={style}>
              {photo && <img src={photo.src} alt={photo.title} draggable={false} />}
            </div>
          )
        }

        return (
          <div
            key={i}
            className={cls}
            style={style}
            role="button"
            tabIndex={0}
            draggable
            aria-pressed={pickedIndex === i}
            aria-label={`${photo?.title ?? "Photo"}, position ${i + 1}`}
            onClick={() => onSlotClick?.(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onSlotClick?.(i)
              }
            }}
            onDragStart={(e) => {
              setDragFrom(i)
              e.dataTransfer.effectAllowed = "move"
              e.dataTransfer.setData("text/plain", String(i))
            }}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (dragFrom !== null && dragFrom !== i) onSwap?.(dragFrom, i)
              setDragFrom(null)
            }}
          >
            {photo && <img src={photo.src} alt={photo.title} draggable={false} />}
          </div>
        )
      })}
    </div>
  )
}

export type SaveHandler = (
  draft: Omit<CollageDraft, "albumId">,
) => SavedCollage | void | Promise<SavedCollage | void>

export interface AlbumCollageProps {
  photos: Photo[]
  onSave?: SaveHandler
  defaultName?: string
  initial?: { id: string; name: string; templateId: string; order: Photo[] }
  onClose?: () => void
}

export function AlbumCollage({ photos, onSave, defaultName, initial, onClose }: AlbumCollageProps) {
  const count = photos.length
  const matches = useMemo(() => templatesFor(count), [count])

  if (matches.length === 0) return <NoTemplateFit count={count} onClose={onClose} />

  return (
    <CollageEditor
      photos={photos}
      matches={matches}
      onSave={onSave}
      defaultName={defaultName}
      initial={initial}
      onClose={onClose}
    />
  )
}

function CollageEditor({
  photos, matches, onSave, defaultName, initial, onClose,
}: {
  photos: Photo[]
  matches: CollageTemplate[]
  onSave?: SaveHandler
  defaultName?: string
  initial?: AlbumCollageProps["initial"]
  onClose?: () => void
}) {
  const nameId = useId()
  const startTemplate = matches.find((t) => t.id === initial?.templateId) ?? matches[0]

  const [templateId, setTemplateId] = useState(startTemplate.id)
  const [order, setOrder] = useState<Photo[]>(initial?.order ?? photos)
  const [picked, setPicked] = useState<number | null>(null)
  const [status, setStatus] = useState("")
  const [name, setName] = useState(initial?.name ?? defaultName ?? "My collage")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // What was last persisted, so Save is only offered when something changed.
  const snapshot = (t: string, o: Photo[], n: string) => `${t}|${o.map((p) => p.id).join(",")}|${n.trim()}`
  const [savedId, setSavedId] = useState<string | undefined>(initial?.id)
  const [savedKey, setSavedKey] = useState<string | null>(
    initial ? snapshot(startTemplate.id, initial.order, initial.name) : null,
  )

  const template = matches.find((t) => t.id === templateId) ?? matches[0]
  const currentKey = snapshot(template.id, order, name)
  const isSaved = savedKey === currentKey
  const canSave = Boolean(onSave) && name.trim().length > 0 && !isSaved && !saving

  const swap = (a: number, b: number) => {
    setOrder((prev) => {
      const next = [...prev]
      ;[next[a], next[b]] = [next[b], next[a]]
      return next
    })
    setStatus(`Swapped position ${a + 1} with position ${b + 1}`)
  }

  const handleSlotClick = (i: number) => {
    if (picked === null) {
      setPicked(i)
      setStatus(`Selected position ${i + 1}. Choose another photo to swap with.`)
    } else if (picked === i) {
      setPicked(null)
      setStatus("Selection cleared")
    } else {
      swap(picked, i)
      setPicked(null)
    }
  }

  const handleSave = async () => {
    if (!onSave || !canSave) return
    const savedName = name.trim()
    const keyAtSave = currentKey
    setSaving(true)
    setSaveError(null)
    try {
      const result = await onSave({
        id: savedId,
        name: savedName,
        templateId: template.id,
        photoIds: order.map((p) => p.id),
      })
      if (result) setSavedId(result.id)
      setSavedKey(keyAtSave)
      setStatus(`Saved “${savedName}”`)
    } catch {
      setSaveError("Couldn’t save the collage. Check your connection and try again.")
      setStatus("Couldn’t save the collage")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ac">
      <div className="ac-stage">
        <CollageLayout
          template={template}
          photos={order}
          pickedIndex={picked}
          onSlotClick={handleSlotClick}
          onSwap={swap}
        />
      </div>

      <p className="am-muted ac-hint">
        Drag a photo onto another to swap them, or select two photos.
      </p>

      {matches.length > 1 && (
        <div role="radiogroup" aria-label="Collage layout" className="ac-picker">
          {matches.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === template.id}
              aria-label={t.name}
              className="ac-thumb"
              onClick={() => { setTemplateId(t.id); setPicked(null) }}
            >
              <CollageLayout template={t} />
            </button>
          ))}
        </div>
      )}

      {onSave && (
        <div className="ac-name">
          <label className="am-label" htmlFor={nameId}>Collage name</label>
          <input
            id={nameId}
            className="am-input"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
          />
        </div>
      )}

      {saveError && <p role="alert" className="ac-error">{saveError}</p>}

      <p className="ac-sr" role="status" aria-live="polite">{status}</p>

      <div className="am-dialog-actions">
        {onClose && <button className="am-btn am-btn--outline" onClick={onClose}>Close</button>}
        {onSave && (
          <button className="am-btn am-btn--primary" onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving…" : isSaved ? "Saved" : savedId ? "Save changes" : "Save collage"}
          </button>
        )}
      </div>
    </div>
  )
}

function NoTemplateFit({ count, onClose }: { count: number; onClose?: () => void }) {
  const counts = supportedCounts()
  const fewer = [...counts].reverse().find((n) => n < count)
  const more = counts.find((n) => n > count)

  const suggestions: string[] = []
  if (more !== undefined && count > 0) suggestions.push(`add ${plural(more - count, "photo")} for a ${more}-photo layout`)
  if (fewer !== undefined) suggestions.push(`remove ${plural(count - fewer, "photo")} for a ${fewer}-photo layout`)

  return (
    <div className="ac ac-nofit" role="alert">
      <h3>Can't make a collage from this album</h3>
      <p>
        This album has {plural(count, "photo")}, and every layout needs an exact number of photos:{" "}
        {counts.join(", ")}.
      </p>
      {count === 0 ? (
        <p>Add photos to the album to get started.</p>
      ) : (
        <p>To make a collage, {suggestions.join(", or ")}.</p>
      )}
      <div className="am-dialog-actions">
        {onClose && <button className="am-btn am-btn--primary" onClick={onClose}>OK</button>}
      </div>
    </div>
  )
}