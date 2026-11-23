export async function reorderAlbumPhotos(albumId: string, photoIds: string[]): Promise<Photo[]> {
  const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/photos`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ photoIds }),
  })
  if (!res.ok) throw new Error("Could not save photo order")
  const body: unknown = await res.json()
  if (!Array.isArray(body)) throw new Error("Could not save photo order")
  const photos = body.map(parsePhoto)
  if (photos.some((photo) => photo === null)) throw new Error("Could not save photo order")
  return photos as Photo[]
}
