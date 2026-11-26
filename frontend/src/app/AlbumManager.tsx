import { Children, createContext, useContext, useEffect, useRef, useState } from "react"
import type { KeyboardEvent, MouseEvent, ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  Plus, Folder, FolderOpen, Edit, Trash2, Users, X, UserPlus, Crown, Eye, ImageIcon, LayoutGrid, Images, MoreHorizontal,
} from "lucide-react"
import "../styles/styles.css"
import { AlbumCollage } from "./AlbumCollage"
import type { SaveHandler } from "./AlbumCollage"
import { SavedCollagesPanel } from "./SavedCollages"
import type { CollageDraft, SavedCollage } from "./collageStore"

// Interfaces 
export interface Photo {
  id: string
  src: string
  thumbnail: string
  title: string
  description: string
  date: string
  albumId: string
  tags: string[]
}

export interface Collaborator {
  id: string
  name: string
  username: string
  avatar: string
  role: "viewer" | "editor"
}

export interface ManagedAlbum {
  id: string
  name: string
  description: string
  coverPhoto?: Photo
  collaborationEnabled: boolean
  collaborators: Collaborator[]
}

interface AlbumManagerProps {
  canLabel?: boolean
  albums: ManagedAlbum[]
  photos: Photo[]
  onAlbumCreate: (album: ManagedAlbum) => void | Promise<void>
  onAlbumSelect: (albumId: string | null) => void
  onAlbumUpdate: (album: ManagedAlbum) => void | Promise<void>
  onAlbumDelete?: (id: string) => Promise<void>
  /** Saved collages. Pass these (with the handlers below) to enable saving and viewing. */
  collages?: SavedCollage[]
  onCollageSave?: (draft: CollageDraft) => Promise<SavedCollage>
  onCollageDelete?: (id: string) => Promise<void>
}

type Role = Collaborator["role"]

const MOCK_INVITE_POOL: Collaborator[] = [
  { id: "ci1", name: "Riley Kim", username: "@rileykim", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&h=80&fit=crop&crop=face", role: "viewer" },
  { id: "ci2", name: "Drew Hassan", username: "@drewhassan", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=80&h=80&fit=crop&crop=face", role: "editor" },
  { id: "ci3", name: "Casey Nguyen", username: "@caseynguyen", avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=80&h=80&fit=crop&crop=face", role: "viewer" },
]
 
// Small UI primitives (replace ./ui/* and ImageWithFallback) 

function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (failedSrc === src) {
    return (
      <div className="am-img-fallback">
        <ImageIcon size={24} />
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailedSrc(src)} />
}

// Native <dialog> rendered in a portal. Handles Esc, focus trapping and backdrop for free.  
function Modal({
  open, onClose, title, small, children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  small?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return createPortal(
    <dialog
      ref={ref}
      className={`am-dialog${small ? " am-dialog--sm" : ""}`}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      // React events bubble through portals, so stop clicks from reaching the album card
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose() // backdrop click
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {open && (
        <div className="am-dialog-body">
          <h2 className="am-dialog-title">{title}</h2>
          <button className="am-btn am-btn--ghost am-btn--icon am-dialog-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
          {/* Reset so nothing inside a dialog renders as a menu row */}
          <MenuContext.Provider value={null}>{children}</MenuContext.Provider>
        </div>
      )}
    </dialog>,
    document.body,
  )
}

// When an IconButton is rendered inside ActionsMenu it becomes a labelled menu row.
const MenuContext = createContext<{ close: () => void } | null>(null)

function IconButton({
  label, onClick, danger, children,
}: {
  label: string
  onClick: (e: MouseEvent) => void
  danger?: boolean
  children: ReactNode
}) {
  const menu = useContext(MenuContext)

  if (menu) {
    return (
      <button
        type="button"
        role="menuitem"
        className={`am-menu-item${danger ? " is-danger" : ""}`}
        onClick={(e) => {
          e.stopPropagation()
          menu.close()
          onClick(e)
        }}
      >
        {children}
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`am-btn am-btn--ghost am-btn--icon${danger ? " am-btn--danger" : ""}`}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
    >
      {children}
    </button>
  )
}

// Collapses the card's action buttons into one "more" button with a dropdown.
// The list stays mounted (only hidden) so each dialog keeps its open state, and it is
// portaled to <body> because .am-card clips overflow and transforms on hover.
function ActionsMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Return focus to the trigger so a dialog opened from the menu restores focus somewhere visible
  const close = () => { setOpen(false); triggerRef.current?.focus() }
  const dismiss = () => setOpen(false)

  const items = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  const toggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    // MouseEvent/KeyboardEvent are imported from React in this file, so use the DOM ones explicitly
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as Node
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) dismiss()
    }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", dismiss, true) // positioned once, so close if the page moves
    window.addEventListener("resize", dismiss)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", dismiss, true)
      window.removeEventListener("resize", dismiss)
    }
  }, [open])

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLElement)
    list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="am-btn am-btn--ghost am-btn--icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More options"
        title="More options"
        onClick={(e) => { e.stopPropagation(); toggle() }}
      >
        <MoreHorizontal size={16} />
      </button>

      {createPortal(
        <ul
          ref={listRef}
          role="menu"
          className="am-menu"
          hidden={!open}
          style={{ top: pos.top, right: pos.right }}
          // React events bubble through portals, so keep clicks from reaching the album card
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onListKeyDown}
        >
          <MenuContext.Provider value={{ close }}>
            {Children.toArray(children).map((child, i) => (
              <li key={i} role="none">{child}</li>
            ))}
          </MenuContext.Provider>
        </ul>,
        document.body,
      )}
    </>
  )
}

// Dialogs 

function RenameAlbumDialog({ album, onUpdate }: { album: ManagedAlbum; onUpdate: (a: ManagedAlbum) => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(album.name)
  const [description, setDescription] = useState(album.description)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpen = () => {
    setName(album.name)
    setDescription(album.description)
    setError(null)
    setOpen(true)
  }

  const handleSave = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onUpdate({ ...album, name: name.trim(), description: description.trim() })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save album")
    } finally { setBusy(false) }
  }

  return (
    <>
      <IconButton label="Rename album" onClick={handleOpen}>
        <Edit size={14} />
      </IconButton>
      <Modal open={open} onClose={() => !busy && setOpen(false)} small title={<><Edit size={16} /> Rename album</>}>
        <div>
          <label className="am-label" htmlFor={`rename-${album.id}`}>Album name</label>
          <input
            id={`rename-${album.id}`}
            className="am-input"
            value={name}
            maxLength={200}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="Album name..."
            onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
            autoFocus
          />
        </div>
        <div>
          <label className="am-label" htmlFor={`rename-desc-${album.id}`}>Description</label>
          <textarea
            id={`rename-desc-${album.id}`}
            className="am-textarea"
            value={description}
            maxLength={2000}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)..."
            rows={2}
          />
        </div>
        <div className="am-dialog-actions">
          <button className="am-btn am-btn--outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          <button className="am-btn am-btn--primary" onClick={handleSave} disabled={busy || !name.trim()}>Save</button>
        </div>
        {error && <p role="alert">{error}</p>}
      </Modal>
    </>
  )
}

function AlbumCoverDialog({
  album, photos, onUpdate,
}: { album: ManagedAlbum; photos: Photo[]; onUpdate: (a: ManagedAlbum) => void }) {
  const [open, setOpen] = useState(false)
  const albumPhotos = photos.filter((p) => p.albumId === album.id)

  const selectCover = (photo: Photo) => {
    onUpdate({ ...album, coverPhoto: photo })
    setOpen(false)
  }

  return (
    <>
      <IconButton label="Choose album cover" onClick={() => setOpen(true)}>
        <ImageIcon size={14} />
      </IconButton>
      <Modal open={open} onClose={() => setOpen(false)} title={<><ImageIcon size={16} /> Choose cover: {album.name}</>}>
        {albumPhotos.length === 0 ? (
          <p className="am-muted" style={{ padding: "24px 0", textAlign: "center", fontSize: 14 }}>
            No photos in this album yet.
          </p>
        ) : (
          <div className="am-cover-grid">
            {albumPhotos.map((photo) => {
              const isCurrent = album.coverPhoto?.id === photo.id
              return (
                <button
                  key={photo.id}
                  className={`am-cover-option${isCurrent ? " is-current" : ""}`}
                  onClick={() => selectCover(photo)}
                  aria-label={`Use ${photo.title} as cover`}
                >
                  <Img src={photo.thumbnail} alt={photo.title} />
                  {isCurrent && (
                    <div className="am-current-tag"><span>Cover</span></div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </Modal>
    </>
  )
}

function CollaboratorsDialog({ album, onUpdate }: { album: ManagedAlbum; onUpdate: (a: ManagedAlbum) => void }) {
  const [open, setOpen] = useState(false)
  const [inviteInput, setInviteInput] = useState("")
  const [inviteRole, setInviteRole] = useState<Role>("viewer")

  const toggleCollaboration = () => onUpdate({ ...album, collaborationEnabled: !album.collaborationEnabled })

  const removeCollaborator = (id: string) =>
    onUpdate({ ...album, collaborators: album.collaborators.filter((c) => c.id !== id) })

  const toggleRole = (id: string) =>
    onUpdate({
      ...album,
      collaborators: album.collaborators.map((c) =>
        c.id === id ? { ...c, role: c.role === "editor" ? "viewer" : "editor" } : c,
      ),
    })

  const handleInvite = () => {
    const trimmed = inviteInput.trim().toLowerCase()
    if (!trimmed) return

    if (album.collaborators.some((c) => c.username.toLowerCase() === trimmed)) {
      setInviteInput("")
      return
    }

    const poolMatch = MOCK_INVITE_POOL.find(
      (c) => c.username.toLowerCase() === trimmed || c.name.toLowerCase() === trimmed,
    )
    const newCollaborator: Collaborator = poolMatch
      ? { ...poolMatch, role: inviteRole }
      : {
          id: `new-${Date.now()}`,
          name: inviteInput.trim(),
          username: `@${inviteInput.trim().toLowerCase().replace(/\s+/g, "")}`,
          avatar: `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(inviteInput)}`,
          role: inviteRole,
        }

    onUpdate({ ...album, collaborators: [...album.collaborators, newCollaborator] })
    setInviteInput("")
  }

  const count = album.collaborators.length

  return (
    <>
      <IconButton label="Manage collaborators" onClick={() => setOpen(true)}>
        <Users size={14} />
      </IconButton>
      <Modal open={open} onClose={() => setOpen(false)} small title={<><Users size={16} /> Collaborators: {album.name}</>}>
        <div className="am-switch-row">
          <div>
            <p>Collaboration</p>
            <p>Allow others to view or edit this album</p>
          </div>
          <button
            type="button"
            role="switch"
            className="am-switch"
            aria-checked={album.collaborationEnabled}
            aria-label="Toggle collaboration"
            onClick={toggleCollaboration}
          />
        </div>

        {album.collaborationEnabled && (
          <>
            <div>
              <p className="am-section-label">Invite by username or name</p>
              <div className="am-invite">
                <input
                  className="am-input am-input--sm"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder="@username or name..."
                  onKeyDown={(e) => { if (e.key === "Enter") handleInvite() }}
                />
                <select
                  className="am-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  aria-label="Role"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  className="am-btn am-btn--primary am-btn--icon"
                  onClick={handleInvite}
                  disabled={!inviteInput.trim()}
                  aria-label="Send invite"
                >
                  <UserPlus size={14} />
                </button>
              </div>
            </div>

            <div>
              <p className="am-section-label">
                {count > 0 ? `${count} collaborator${count !== 1 ? "s" : ""}` : "No collaborators yet"}
              </p>
              {count === 0 && (
                <p className="am-muted" style={{ padding: "12px 0", textAlign: "center", fontSize: 14 }}>
                  Invite someone above to get started
                </p>
              )}
              <ul className="am-collab-list">
                {album.collaborators.map((c) => (
                  <li key={c.id} className="am-collab">
                    <img src={c.avatar} alt={c.name} />
                    <div className="am-collab-info">
                      <p>{c.name}</p>
                      <p>{c.username}</p>
                    </div>
                    <button className="am-chip" onClick={() => toggleRole(c.id)} title="Click to toggle role">
                      {c.role === "editor" ? <Crown size={10} className="editor" /> : <Eye size={10} />}
                      <span style={{ textTransform: "capitalize" }}>{c.role}</span>
                    </button>
                    <button
                      className="am-collab-remove"
                      onClick={() => removeCollaborator(c.id)}
                      aria-label={`Remove ${c.name}`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

function CollageDialog({
  album, photos, onSave,
}: { album: ManagedAlbum; photos: Photo[]; onSave?: (draft: CollageDraft) => Promise<SavedCollage> }) {
  const [open, setOpen] = useState(false)
  const albumPhotos = photos.filter((p) => p.albumId === album.id)
  const handleSave: SaveHandler | undefined = onSave && ((draft) => onSave({ ...draft, albumId: album.id }))

  return (
    <>
      <IconButton label="Create collage" onClick={() => setOpen(true)}>
        <LayoutGrid size={14} />
      </IconButton>
      <Modal open={open} onClose={() => setOpen(false)} title={<><LayoutGrid size={16} /> Collage: {album.name}</>}>
        <AlbumCollage
          photos={albumPhotos}
          defaultName={`${album.name} collage`}
          onSave={handleSave}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}

function SavedCollagesDialog({
  album, photos, collages, onSave, onDelete,
}: {
  album: ManagedAlbum
  photos: Photo[]
  collages: SavedCollage[]
  onSave?: (draft: CollageDraft) => Promise<SavedCollage>
  onDelete?: (id: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const albumPhotos = photos.filter((p) => p.albumId === album.id)
  const count = collages.filter((c) => c.albumId === album.id).length
  const handleSave: SaveHandler | undefined = onSave && ((draft) => onSave({ ...draft, albumId: album.id }))

  return (
    <>
      <IconButton label={`Saved collages (${count})`} onClick={() => setOpen(true)}>
        <Images size={14} />
      </IconButton>
      <Modal open={open} onClose={() => setOpen(false)} title={<><Images size={16} /> Saved collages: {album.name}</>}>
        <SavedCollagesPanel
          album={album}
          photos={albumPhotos}
          collages={collages}
          onSave={handleSave}
          onDelete={onDelete}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}

// Main album components 

export function AlbumManager({
  albums, photos, onAlbumCreate, onAlbumSelect, onAlbumUpdate, onAlbumDelete, collages, onCollageSave, onCollageDelete, canLabel = true,
}: AlbumManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateAlbum = async () => {
    if (busy || !newName.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onAlbumCreate({
      id: "",
      name: newName.trim(),
      description: newDescription.trim(),
      collaborationEnabled: false,
      collaborators: [],
    })
    setNewName("")
    setNewDescription("")
    setIsCreateOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create album")
    } finally { setBusy(false) }
  }

  const handleDelete = async (album: ManagedAlbum) => {
    if (busy || !onAlbumDelete || !window.confirm(`Delete ${album.name}? Photos stay in your library; saved collages are removed.`)) return
    setBusy(true)
    setError(null)
    try { await onAlbumDelete(album.id) } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete album")
    } finally { setBusy(false) }
  }

  const photoCount = (albumId: string) => photos.filter((p) => p.albumId === albumId).length
  const albumPhotoCounts = albums.map((album) => photoCount(album.id))
  const largest = albumPhotoCounts.length ? Math.max(...albumPhotoCounts) : 0
  const average = albumPhotoCounts.length ? Math.round(photos.length / albumPhotoCounts.length) : 0

  const coverFor = (album: ManagedAlbum) =>
    album.coverPhoto ?? photos.find((p) => p.albumId === album.id) ?? null

  const onCardKeyDown = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      onAlbumSelect(id)
    }
  }

  return (
    <div className="am">
      <div className="am-header">
        <div>
          <h2 className="am-title">Photo albums</h2>
          <p className="am-muted">Organize your photos into collections</p>
        </div>
        {canLabel && <button className="am-btn am-btn--primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          New album
        </button>}
      </div>

      {error && !isCreateOpen && <p role="alert">{error}</p>}
      <Modal open={isCreateOpen} onClose={() => !busy && setIsCreateOpen(false)} title="Create new album">
        <div>
          <label className="am-label" htmlFor="album-name">Album name</label>
          <input
            id="album-name"
            className="am-input"
            value={newName}
            maxLength={200}
            disabled={busy}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateAlbum() }}
            placeholder="Enter album name..."
            autoFocus
          />
        </div>
        <div>
          <label className="am-label" htmlFor="album-description">Description (optional)</label>
          <textarea
            id="album-description"
            className="am-textarea"
            value={newDescription}
            maxLength={2000}
            disabled={busy}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Enter album description..."
            rows={3}
          />
        </div>
        <div className="am-dialog-actions">
          <button className="am-btn am-btn--outline" onClick={() => setIsCreateOpen(false)} disabled={busy}>Cancel</button>
          <button className="am-btn am-btn--primary" onClick={handleCreateAlbum} disabled={busy || !newName.trim()}>
            Create album
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </Modal>

      {albums.length === 0 ? (
        <div className="am-empty">
          <Folder size={48} />
          <h3>No albums yet</h3>
          <p className="am-muted">{canLabel ? "Create your first album to organize your photos" : "Ask an administrator to provision an album for your account."}</p>
          {canLabel && <button className="am-btn am-btn--primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} />
            Create album
          </button>}
        </div>
      ) : (
        <div className="am-grid">
          {albums.map((album) => {
            const count = photoCount(album.id)
            const cover = coverFor(album)
            const collabs = album.collaborators

            return (
              <div
                key={album.id}
                className="am-card"
                role="link"
                tabIndex={0}
                aria-label={`Open ${album.name}`}
                onClick={() => onAlbumSelect(album.id)}
                onKeyDown={(e) => onCardKeyDown(e, album.id)}
              >
                <div className="am-cover">
                  {cover ? (
                    <Img src={cover.thumbnail} alt={album.name} />
                  ) : (
                    <div className="am-cover-empty"><FolderOpen size={48} /></div>
                  )}

                  <span className="am-badge">{count} photo{count !== 1 ? "s" : ""}</span>

                  {album.collaborationEnabled && collabs.length > 0 && (
                    <div className="am-avatars">
                      {collabs.slice(0, 3).map((c) => (
                        <img
                          key={c.id}
                          className="am-avatar"
                          src={c.avatar}
                          alt={c.name}
                          title={`${c.name} (${c.role})`}
                        />
                      ))}
                      {collabs.length > 3 && <div className="am-avatar-more">+{collabs.length - 3}</div>}
                    </div>
                  )}
                </div>

                <div className="am-card-body">
                  <div className="am-card-title">
                    <span>{album.name}</span>
                    <div className="am-actions">
                      <ActionsMenu>
                        <CollageDialog album={album} photos={photos} onSave={onCollageSave} />
                        {collages && (
                          <SavedCollagesDialog
                            album={album}
                            photos={photos}
                            collages={collages}
                            onSave={onCollageSave}
                            onDelete={onCollageDelete}
                          />
                        )}
                        <CollaboratorsDialog album={album} onUpdate={onAlbumUpdate} />
                        <AlbumCoverDialog album={album} photos={photos} onUpdate={onAlbumUpdate} />
                        {canLabel && <RenameAlbumDialog album={album} onUpdate={onAlbumUpdate} />}
                        <IconButton label="Delete album" danger onClick={() => void handleDelete(album)}>
                          <Trash2 size={14} />
                        </IconButton>
                      </ActionsMenu>
                    </div>
                  </div>

                  {album.description && <p className="am-card-desc am-muted">{album.description}</p>}

                  {album.collaborationEnabled && (
                    <div className="am-card-meta am-muted">
                      <Users size={12} />
                      <span>
                        {collabs.length > 0
                          ? `${collabs.length} collaborator${collabs.length !== 1 ? "s" : ""}`
                          : "Collaboration on"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="am-stats">
        <h2>Collection Overview</h2>
        <br></br>
        <div className="am-stats-grid">
          <div className="am-stat"><strong>{albums.length}</strong><span>Albums</span></div>
          <div className="am-stat"><strong>{photos.length}</strong><span>Album photo memberships</span></div>
          <div className="am-stat"><strong>{largest}</strong><span>Photos in largest album</span></div>
          <div className="am-stat"><strong>{average}</strong><span>Average photos per album</span></div>
        </div>
      </div>
    </div>
  )
}
