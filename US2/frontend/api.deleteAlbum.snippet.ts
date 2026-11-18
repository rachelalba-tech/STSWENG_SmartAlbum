export async function deleteAlbum(id: string): Promise<void> {
  const res = await fetch(`/api/albums/${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Could not delete album")
}
