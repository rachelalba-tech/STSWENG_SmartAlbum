/* Add editing state */
  const [editing, setEditing] = useState(false)
  const [headline, setHeadline] = useState(album.title)
  const [description, setDescription] = useState(album.description ?? "")

/* Add save handler */
  const saveDetails = async () => {
    if (!headline.trim() || !onAlbumUpdate) return
    setSaving(true)
    setError(null)
    try {
      await onAlbumUpdate({ title: headline.trim(), description: description.trim() })
      setEditing(false)
    } catch {
      setError("Could not save album details. Please try again.")
    } finally {
      setSaving(false)
    }
  }

/* Add editor UI inside AlbumPage return */
      <div className="album-heading">
        <div>
          <h2>{album.title}</h2>
          {album.description && <p>{album.description}</p>}
        </div>
        <div className="album-actions">
          <button type="button" onClick={() => {
            setHeadline(album.title)
            setDescription(album.description ?? "")
            setEditing((open) => !open)
          }}>
            {editing ? "Close editor" : "Edit album details"}
          </button>
          <button type="button" onClick={() => setAdding(true)}>Add photos</button>
        </div>
      </div>

      {error && <p role="alert" className="album-error">{error}</p>}

      {editing && (
        <section className="album-editor" aria-label="Edit album details">
          <label htmlFor="album-headline">Headline</label>
          <input id="album-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={120} />
          <label htmlFor="album-description">Description</label>
          <textarea id="album-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={1000} />
          <div className="album-editor-actions">
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" onClick={() => void saveDetails()} disabled={!headline.trim() || saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>
      )}
