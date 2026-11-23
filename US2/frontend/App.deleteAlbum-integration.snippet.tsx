/* Add this prop to the existing <AlbumManager ... /> */
      onAlbumDelete={async (id) => {
        await deleteAlbum(id)
        setAlbums((prev) => (prev ?? []).filter((album) => album.id !== id))
        setPhotos((prev) => prev.map((photo) => photo.albumId === id ? { ...photo, albumId: "" } : photo))
      }}
