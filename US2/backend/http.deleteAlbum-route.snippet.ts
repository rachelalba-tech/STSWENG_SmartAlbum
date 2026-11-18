    if (req.method === "DELETE" && /^\/api\/albums\/[^/]+$/.test(url.pathname)) {
      const match = url.pathname.match(/^\/api\/albums\/([^/]+)$/)
      const id = match ? safeDecode(match[1]) : null
      const index = id === null ? -1 : albums.findIndex((a) => a.id === id && a.ownerId === ownerId)
      if (index < 0) {
        send(res, 404, { error: "album not found" })
        return
      }
      const [removed] = albums.splice(index, 1)
      // Keep the photo files in the user's library; deleting an album only clears membership.
      const changed = (photoStorage?.photos ?? []).filter((p) => p.ownerId === ownerId && p.albumId === removed.id)
      for (const photo of changed) photo.albumId = ""
      try {
        if (photoStorage && changed.length) photoStorage.save(photoStorage.photos)
        saveAlbums?.(albums)
        send(res, 200, { deleted: true })
      } catch (err) {
        albums.splice(index, 0, removed)
        for (const photo of changed) photo.albumId = removed.id
        if (photoStorage && changed.length) {
          try { photoStorage.save(photoStorage.photos) } catch { /* preserve the original error */ }
        }
        try { saveAlbums?.(albums) } catch { /* preserve the original error */ }
        throw err
      }
      return
    }
