/* Add this prop to the existing <AlbumManager ... /> */
      onAlbumCreate={async (album) => {
        const created = await createAlbum(album.name, album.description)
        setAlbums((prev) => [...(prev ?? []), toManaged(created)])
      }}
