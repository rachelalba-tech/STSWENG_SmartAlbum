/* Existing AlbumManager component: create-album state and handler */
export function AlbumManager({ albums, photos, onAlbumCreate, onAlbumDelete, onAlbumSelect, onAlbumUpdate }: AlbumManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleCreateAlbum = async () => {
    if (!newName.trim()) return
    setIsSaving(true)
    setActionError(null)
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
    } catch {
      setActionError("Could not create the album. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

/* Create Album dialog JSX (place inside the component return) */
        <button className="am-btn am-btn--primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          New album
        </button>
      </div>

      {actionError && <p role="alert" className="am-error">{actionError}</p>}
      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create new album">
        <div>
          <label className="am-label" htmlFor="album-name">Album name</label>
          <input
            id="album-name"
            className="am-input"
            value={newName}
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
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Enter album description..."
            rows={3}
          />
        </div>
        <div className="am-dialog-actions">
          <button className="am-btn am-btn--outline" onClick={() => setIsCreateOpen(false)}>Cancel</button>
          <button className="am-btn am-btn--primary" onClick={() => void handleCreateAlbum()} disabled={!newName.trim() || isSaving}>
            {isSaving ? "Creating..." : "Create album"}
          </button>
        </div>
      </Modal>
