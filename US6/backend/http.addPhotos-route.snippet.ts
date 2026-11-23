    const addPhotos = url.pathname.match(/^\/api\/albums\/([^/]+)\/photos$/)
    if (addPhotos && req.method === "PATCH") {
      const id = safeDecode(addPhotos[1])
      const album = id === null ? undefined : openAlbum(albums, ownerId, id)
      if (!album || !photoStorage) {
        send(res, album ? 501 : 404, { error: album ? "photo storage is not configured" : "album not found" })
        return
      }
      readJson(req).then((body) => {
        const photoIds = body?.photoIds
        if (!Array.isArray(photoIds) || !photoIds.every((value) => typeof value === "string") ||
          new Set(photoIds).size !== photoIds.length) {
          send(res, 400, { error: "photoIds must be a unique array of strings" })
          return
        }
        const selected = photoIds.map((photoId) => photoStorage.photos.find(
          (photo) => photo.id === photoId && photo.ownerId === ownerId,
        ))
        if (selected.some((photo) => !photo)) {
          send(res, 404, { error: "one or more photos were not found" })
          return
        }
        const previous = selected.map((photo) => ({ photo, albumId: photo!.albumId, position: photo!.position }))
        let nextPosition = photoStorage.photos.filter((photo) => photo.ownerId === ownerId && photo.albumId === id)
          .reduce((max, photo) => Math.max(max, photo.position ?? -1), -1) + 1
        for (const photo of selected) {
          photo!.albumId = id
          photo!.position = nextPosition++
        }
        try {
          photoStorage.save(photoStorage.photos)
          send(res, 200, listPhotosForUser(photoStorage.photos, ownerId, id))
        } catch (err) {
          for (const item of previous) {
            item.photo!.albumId = item.albumId
            item.photo!.position = item.position
          }
          throw err
        }
      }).catch(fail)
      return
    }
