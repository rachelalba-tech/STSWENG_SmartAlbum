/* Add library photo state in AlbumRoute */
const [libraryPhotos, setLibraryPhotos] = useState<Photo[]>([])

/* Fetch full library alongside album photos */
    fetchPhotos(id).then(
      (next) => { if (active) setPhotos(next) },
      () => { if (active) setPhotoError("Could not load photos.") },
    )
    fetchPhotos().then((next) => { if (active) setLibraryPhotos(next) }, () => {})
    return () => { active = false }
  }, [id])

/* Add handler inside AlbumRoute */
  const handleAddPhotos = async (photoIds: string[]) => {
    const updated = await addPhotosToAlbum(id, photoIds)
    setPhotos(updated)
    setLibraryPhotos(await fetchPhotos())
  }

/* Pass these props to AlbumPage */
libraryPhotos={libraryPhotos}
onAddPhotos={handleAddPhotos}
