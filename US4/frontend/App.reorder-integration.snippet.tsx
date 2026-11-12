/* Add inside AlbumRoute */
  const handleReorder = async (photoIds: string[]) => {
    setPhotos(await reorderAlbumPhotos(id, photoIds))
  }

/* Pass to AlbumPage */
onReorder={handleReorder}
