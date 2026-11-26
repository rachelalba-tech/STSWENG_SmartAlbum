import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, DragEvent } from "react"
import { Plus, Upload } from "lucide-react"
import "../styles/PhotoUpload.css"
import { uploadPhoto } from "./api.ts"
import type { Photo } from "./api.ts"

// Limits
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB per photo
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const CONCURRENCY = 3

// Types
type Status = "queued" | "uploading" | "done" | "error"

interface Item {
  key: string
  file: File
  previewUrl: string
  status: Status
  error?: string
}

interface PhotoUploadProps {
  albums: { id: string; name: string }[]
  onUploaded?: (photos: Photo[]) => void
  upload?: (albumId: string, file: File) => Promise<Photo>
}

const keyOf = (f: File) => `${f.name}:${f.size}:${f.lastModified}`

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0
  const lane = async () => {
    while (next < items.length) await worker(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
}

// Component
export function PhotoUpload({ albums, onUploaded, upload = uploadPhoto }: PhotoUploadProps) {
  const [chosenId, setAlbumId] = useState("")
  // Fall back to library-only upload if the chosen album is no longer present
  const albumId = chosenId === "" || albums.some((a) => a.id === chosenId) ? chosenId : ""
  const [items, setItems] = useState<Item[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const urls = useRef(new Set<string>())
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const all = urls.current
    return () => {
      mounted.current = false
      all.forEach((u) => URL.revokeObjectURL(u))
      all.clear()
    }
  }, [])

  const patch = (key: string, change: Partial<Item>) => {
    if (!mounted.current) return
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...change } : i)))
  }

  // Used by both the file picker and drag and drop 
  const addFiles = (picked: File[]) => {
    if (picked.length === 0) return

    const known = new Set(items.map((i) => i.key))
    const added: Item[] = []
    const problems: string[] = []

    for (const file of picked) {
      const key = keyOf(file)
      if (!ACCEPTED_TYPES.includes(file.type)) {
        problems.push(`${file.name} is not a JPG, PNG, GIF or WebP image`)
      } else if (file.size > MAX_FILE_BYTES) {
        problems.push(`${file.name} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`)
      } else if (known.has(key)) {
        problems.push(`${file.name} is already selected`)
      } else {
        known.add(key)
        const previewUrl = URL.createObjectURL(file)
        urls.current.add(previewUrl)
        added.push({ key, file, previewUrl, status: "queued" })
      }
    }

    setItems((prev) => [...prev, ...added])
    setNotice(problems.length ? `Skipped: ${problems.join("; ")}.` : null)
  }

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = "" // allow picking the same file again later
    addFiles(picked)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (busy) return
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault() // required, otherwise the browser refuses the drop
    if (!busy) setDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }

  const remove = (key: string) => {
    const item = items.find((i) => i.key === key)
    if (!item || item.status === "uploading") return
    URL.revokeObjectURL(item.previewUrl)
    urls.current.delete(item.previewUrl)
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  const clearUploaded = () => {
    for (const i of items.filter((x) => x.status === "done")) {
      URL.revokeObjectURL(i.previewUrl)
      urls.current.delete(i.previewUrl)
    }
    setItems((prev) => prev.filter((i) => i.status !== "done"))
  }

  const pending = items.filter((i) => i.status === "queued" || i.status === "error")
  const doneCount = items.filter((i) => i.status === "done").length

  const handleUpload = async () => {
    if (busy || pending.length === 0) return
    setBusy(true)
    setNotice(null)
    const batch = pending
    batch.forEach((i) => patch(i.key, { status: "uploading", error: undefined }))

    const saved: Photo[] = []
    await runPool(batch, CONCURRENCY, async (item) => {
      try {
        const photo = await upload(albumId, item.file)
        saved.push(photo)
        patch(item.key, { status: "done" })
      } catch (err) {
        // Failed files stay in the list so they can be retried, never dropped.
        patch(item.key, { status: "error", error: err instanceof Error ? err.message : "Upload failed" })
      }
    })

    if (saved.length > 0) onUploaded?.(saved)
    if (mounted.current) {
      setBusy(false)
      const failed = batch.length - saved.length
      setNotice(
        failed === 0
          ? `Uploaded ${saved.length} photo${saved.length !== 1 ? "s" : ""}.`
          : `Uploaded ${saved.length} of ${batch.length}. ${failed} failed and can be retried.`,
      )
    }
  }

  return (
    <div className="pu">
      <h2>Upload Photos</h2>
      <p className="pu-sub">Add new photos to your collection</p>

      <div className="pu-album">
        <label htmlFor="pu-album">Upload to album</label>
        <select id="pu-album" value={albumId} onChange={(e) => setAlbumId(e.target.value)} disabled={busy}>
          <option value="">No album (Photos only)</option>
          {albums.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`pu-drop${dragging ? " is-dragging" : ""}`}
        onClick={() => !busy && inputRef.current?.click()}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload size={48} aria-hidden="true" />
        <p className="pu-drop-title">Drop photos here</p>
        <p className="pu-drop-sub">or click to select files from your device</p>
        <button type="button" className="pu-btn pu-btn--primary" disabled={busy}>
          <Plus size={16} aria-hidden="true" />
          Select Photos
        </button>
        <p className="pu-drop-hint">Supports: JPG, PNG, GIF, WebP</p>
      </div>
      
      <input
        ref={inputRef}
        className="pu-input"
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        aria-label="Choose photos"
        onChange={handleSelect}
        disabled={busy}
      />

      {notice && <p role="status" className="pu-notice">{notice}</p>}

      {items.length > 0 && (
        <ul className="pu-list">
          {items.map((i) => (
            <li key={i.key} className="pu-item" data-status={i.status}>
              <img src={i.previewUrl} alt={i.file.name} width={48} height={48} />
              <span className="pu-item-name">{i.file.name}</span>
              <span className={`pu-item-status${i.status === "error" ? " is-error" : ""}`}>
                {i.status === "queued" && "Ready"}
                {i.status === "uploading" && "Uploading…"}
                {i.status === "done" && "Uploaded"}
                {i.status === "error" && `Failed: ${i.error}`}
              </span>
              <button
                type="button"
                className="pu-btn pu-btn--outline"
                onClick={() => remove(i.key)}
                disabled={i.status === "uploading"}
                aria-label={`Remove ${i.file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="pu-actions">
          <button
            type="button"
            className="pu-btn pu-btn--primary"
            onClick={handleUpload}
            disabled={busy || pending.length === 0}
          >
            {busy ? "Uploading…" : `Upload ${pending.length} photo${pending.length !== 1 ? "s" : ""}`}
          </button>
          {doneCount > 0 && !busy && (
            <button type="button" className="pu-btn pu-btn--outline" onClick={clearUploaded}>
              Clear uploaded
            </button>
          )}
        </div>
      )}
    </div>
  )
}