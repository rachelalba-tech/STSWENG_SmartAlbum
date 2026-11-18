export async function addPhotosToAlbum(albumId: string, photoIds: string[]): Promise<Photo[]> {
  const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/photos`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ photoIds }),
  })
  if (!res.ok) throw new Error("Could not add photos to album")
  const body: unknown = await res.json()
  if (!Array.isArray(body)) throw new Error("Could not add photos to album")
  const photos = body.map(parsePhoto)
  if (photos.some((photo) => photo === null)) throw new Error("Could not add photos to album")
  return photos as Photo[]
}
