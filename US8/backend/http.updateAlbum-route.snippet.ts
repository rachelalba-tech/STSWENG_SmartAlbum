    if (req.method === "PATCH" && /^\/api\/albums\/[^/]+$/.test(url.pathname)) {
      const match = url.pathname.match(/^\/api\/albums\/([^/]+)$/)
      const id = match ? safeDecode(match[1]) : null
      const album = id === null ? undefined : openAlbum(albums, ownerId, id)
      if (!album) {
        send(res, 404, { error: "album not found" })
        return
      }
      readJson(req).then((body) => {
        if (!body || (body.title !== undefined && typeof body.title !== "string") ||
          (body.description !== undefined && typeof body.description !== "string")) {
          send(res, 400, { error: "invalid album details" })
          return
        }
        const previous = { ...album }
        if (typeof body.title === "string" && body.title.trim()) album.title = body.title.trim()
        if (typeof body.description === "string") album.description = body.description.trim()
        try {
          saveAlbums?.(albums)
          send(res, 200, album)
        } catch (err) {
          Object.assign(album, previous)
          throw err
        }
      }).catch(fail)
      return
    }
