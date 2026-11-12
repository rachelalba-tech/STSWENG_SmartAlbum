/* Add to AlbumPage component state */
  const [adding, setAdding] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

/* Add handler */
  const addSelectedPhotos = async () => {
    if (!onAddPhotos || selectedPhotos.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await onAddPhotos(selectedPhotos)
      setSelectedPhotos([])
      setAdding(false)
    } catch {
      setError("Could not add the selected photos. Please try again.")
    } finally {
      setSaving(false)
    }
  }

/* Add this UI block inside the AlbumPage return */
      {adding && (
        <section className="album-editor" aria-label="Add photos to album">
          <h3>Select photos from your library</h3>
          {availablePhotos.length === 0 ? (
            <p>No other photos are available in your library.</p>
          ) : (
            <div className="album-library-grid">
              {availablePhotos.map((photo) => (
                <label key={photo.id} className="album-library-photo">
                  <input
                    type="checkbox"
                    checked={selectedPhotos.includes(photo.id)}
                    onChange={(event) => setSelectedPhotos((current) =>
                      event.target.checked ? [...current, photo.id] : current.filter((id) => id !== photo.id),
                    )}
                  />
                  <img src={photo.thumbnail} alt={photo.title || "Photo"} />
                  <span>{photo.title || "Untitled photo"}</span>
                </label>
              ))}
            </div>
          )}
          <div className="album-editor-actions">
            <button type="button" onClick={() => { setAdding(false); setSelectedPhotos([]) }}>Cancel</button>
            <button type="button" onClick={() => void addSelectedPhotos()} disabled={selectedPhotos.length === 0 || saving}>
              {saving ? "Adding..." : `Add ${selectedPhotos.length} selected`}
            </button>
          </div>
        </section>
      )}
