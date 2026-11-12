export async function updateAlbum(
  id: string,
  details: { title?: string; description?: string },
): Promise<Album> {
  const res = await fetch(`/api/albums/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(details),
  })
  if (!res.ok) throw new Error("Could not update album")
  const body: unknown = await res.json()
  if (!isAlbum(body)) throw new Error("Could not update album")
  return body
}
