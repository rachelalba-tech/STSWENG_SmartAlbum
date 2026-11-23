/* Add inside AlbumRoute */
  const handleAlbumUpdate = async (details: { title?: string; description?: string }) => {
    const updated = await updateAlbum(id, details)
    setAlbum(updated)
  }

/* Pass to AlbumPage */
onAlbumUpdate={handleAlbumUpdate}
