/* Add to AlbumPage component state/handlers */
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [orderedPhotos, setOrderedPhotos] = useState<Photo[]>(photos)

  useEffect(() => setOrderedPhotos(photos), [photos])

  const saveOrder = async () => {
    if (!onReorder) return
    setSaving(true)
    setError(null)
    try {
      await onReorder(orderedPhotos.map((photo) => photo.id))
    } catch {
      setError("Could not save the photo order. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const movePhoto = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= orderedPhotos.length) return
    const next = [...orderedPhotos]
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrderedPhotos(next)
  }

  const dropPhoto = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    const next = [...orderedPhotos]
    const from = next.findIndex((photo) => photo.id === draggedId)
    const to = next.findIndex((photo) => photo.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDraggedId(null)
    setOrderedPhotos(next)
  }

/* Add this UI block in the AlbumPage return after the empty-photo check */
          <p className="album-reorder-hint">Drag photos to rearrange them, or use the arrow buttons to change their order.</p>
          {orderedPhotos.some((photo, index) => photo.id !== photos[index]?.id) && (
            <div className="album-editor-actions">
              <button type="button" onClick={() => setOrderedPhotos(photos)} disabled={saving}>Discard order</button>
              <button type="button" onClick={() => void saveOrder()} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
          <ul className="photos album-photo-grid" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: 12 }}>
            {orderedPhotos.map((photo, index) => (
              <li
                key={photo.id}
                draggable={!saving}
                onDragStart={() => setDraggedId(photo.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropPhoto(photo.id)}
                onDragEnd={() => setDraggedId(null)}
                className={draggedId === photo.id ? "is-dragging" : ""}
              >
                <a href={photo.src} target="_blank" rel="noreferrer">
                  <img src={photo.thumbnail} alt={photo.title || "Photo"} width={160} height={160} loading="lazy" style={{ objectFit: "cover" }} />
                </a>
                <div className="album-photo-controls">
                  <span>{index + 1}</span>
                  <button type="button" aria-label={`Move photo ${index + 1} up`} onClick={() => movePhoto(index, -1)} disabled={index === 0 || saving}>↑</button>
                  <button type="button" aria-label={`Move photo ${index + 1} down`} onClick={() => movePhoto(index, 1)} disabled={index === orderedPhotos.length - 1 || saving}>↓</button>
                </div>
              </li>
            ))}
          </ul>
        </>
