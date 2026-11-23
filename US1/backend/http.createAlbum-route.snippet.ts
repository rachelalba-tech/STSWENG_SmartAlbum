    if (req.method === "POST" && url.pathname === "/api/albums") {
      readJson(req).then((body) => {
        const title = typeof body?.title === "string" ? body.title.trim() : ""
        const description = typeof body?.description === "string" ? body.description.trim() : ""
        if (!title) {
          send(res, 400, { error: "album title is required" })
          return
        }
        const album: Album = { id: randomUUID(), title, description, ownerId }
        albums.push(album)
        try {
          saveAlbums?.(albums)
          send(res, 201, album)
        } catch (err) {
          albums.pop()
          throw err
        }
      }).catch(fail)
      return
    }
