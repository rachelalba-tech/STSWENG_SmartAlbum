    if (addPhotos && req.method === "PUT") {
      const id = safeDecode(addPhotos[1])
      const album = id === null ? undefined : openAlbum(albums, ownerId, id)
      if (!album || !photoStorage) {
        send(res, album ? 501 : 404, { error: album ? "photo storage is not configured" : "album not found" })
        return
      }
      readJson(req).then((body) => {
        const photoIds = body?.photoIds
        const current = photoStorage.photos.filter((photo) => photo.ownerId === ownerId && photo.albumId === id)
        if (!Array.isArray(photoIds) || !photoIds.every((value) => typeof value === "string") ||
          photoIds.length !== current.length || new Set(photoIds).size !== current.length ||
          !current.every((photo) => photoIds.includes(photo.id))) {
          send(res, 400, { error: "photoIds must contain every album photo exactly once" })
          return
        }
        const previous = current.map((photo) => photo.position)
        photoIds.forEach((photoId, position) => {
          const photo = current.find((item) => item.id === photoId)!
          photo.position = position
        })
        try {
          photoStorage.save(photoStorage.photos)
          send(res, 200, listPhotosForUser(photoStorage.photos, ownerId, id))
        } catch (err) {
          current.forEach((photo, index) => { photo.position = previous[index] })
          throw err
        }
      }).catch(fail)
      return
    }
